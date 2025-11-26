const express = require('express')
const cors =require('cors')
const app = express()
require('dotenv').config()
const port = process.env.PORT|| 3000


app.use(express.json())
app.use(cors())



// mongo db file  
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zgnatwl.mongodb.net/?appName=Cluster0`;

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


    const db = client.db("zap-shift")
    const percelSellCollcetion = db.collection("percel-Sell")

    // percel sell api
    app.get('/percel', async (req, res)=>{
      const query ={}
      const {email} = req.query;
      if(email){
        query.senderEmail=email
      }
      const options = {sort: {createAt: -1}}
      const curs = percelSellCollcetion.find(query, options)
      const result = await curs.toArray()
        res.send(result)
    } )

    // singel data get
    app.get("/percel/:id", async(req, res)=>{
      const id = req.params.id;
      const query = { _id : new ObjectId(id)}
      const result = await  percelSellCollcetion.findOne(query)
      res.send(result)
    })
    app.post('/percel', async (req, res)=>{
        const percel =req.body;
        percel.createAt= new Date ()
        // sort 
        
        const result = await percelSellCollcetion.insertOne(percel)
        res.send(result)
        // console.log(result);
    } )

    //
    app.delete('/percel/:id', async(req,res)=>{
      const id = req.params.id
      const query= {_id : new ObjectId(id)}
      const result = await percelSellCollcetion.deleteOne(query)
      // console.log(id);
      res.send(result)
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
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
