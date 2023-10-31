const express = require('express')
const cors = require('cors')
var cookieParser = require('cookie-parser')
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5002;

//middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))
app.use(cookieParser())

//create own middleware
const logger = async (req, res, next) => {
  console.log('called', req.host, req.originalUrl)
  next();
}

// const varifyToken=async(req,res,next)=>{
//   const Token=req.cookies?.token
//   console.log("token is:",Token)
//   if (!Token) {
//     return res.status(401).send({messages:"not authorized"})
//   }
//   jwt.verify(Token,process.env.ACCESS_SECRET_TOKEN,function(err,decoded){
//     if (err) {
//       console.log(err);
//       return res.status(401).send({messages:"unauthorized"})
//     }
//     console.log("value of the token",decoded)
//     req.user=decoded
//     next()
//   })
// }
const varifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).send({ messages: "unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(401).send({ messages: "unauthorized" });
    }
    req.user = decoded;
    next()
  })
}
const userName = process.env.DB_USER
const password = process.env.DB_PASS

const uri = `mongodb+srv://${userName}:${password}@cluster0.25fgudl.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    //authentication related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '1h' })
      // console.log(token);
      res.cookie("token", token, {
        httpOnly: true,
        secure: false
        // sameSite:"none"
      })
        .send({ success: true })
    })

    const DBService = client.db("carDoctor").collection("services");
    const DBCheckOut = client.db("carDoctor").collection('checkOut');

    //checkout
    app.post('/checkOut', async (req, res) => {
      const data = req.body;
      const result = await DBCheckOut.insertOne(data);
      res.send(result)
    })
    app.get('/checkOut',varifyToken, async (req, res) => {
      console.log(req.cookies.token);
      console.log("user token", req.user)
      if (req.cookies.token !=req.user.email) {
        return res.status(403).send({messages:'forbiden'})
      }
      let query = {}
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const cursor = await DBCheckOut.find(query).toArray();
      res.send(cursor)
    })
    app.delete('/checkOut/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const query = { _id: new ObjectId(id) }
      const result = await DBCheckOut.deleteOne(query)
      res.send(result)
    })
    app.patch('/checkOut/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      // const options = { upsert: true };
      // Specify the update to set a value for the plot field
      const updateDoc = {
        $set: {
          status: data.status
        },
      };

      const result = await DBCheckOut.updateOne(filter, updateDoc)

      res.send(result)
    })
    //services 
    app.get('/services', logger, async (req, res) => {
      const cursor = await DBService.find().toArray()
      res.send(cursor)
    })

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        // Sort matched documents in descending order by rating

        // Include only the `title` and `imdb` fields in the returned document
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };

      const cursor = await DBService.findOne(query, options)
      res.send(cursor);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("doctor is connecting");
})

app.listen(port, () => {
  console.log("running port is", port);
})