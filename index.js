const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()

// strip
const stripe = require('stripe')(process.env.STRIPE_KEY);
const port = process.env.PORT || 3000


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

function generateTrackingId() {
  return Date.now(); 
}

// midelware 
const verifyFbToken= async (req, res, next)=>{
  const token = req.headers.authorization;
  // console.log(token);
  if(!token){
    return res.status(401).send({message: "Unauthoraize User"})
  }
  try {
    const idToken =  token.split(' ')[1];
    const decode = await admin.auth().verifyIdToken(idToken);
    // console.log('object', decode);
    req.decode_email = decode.email;
    next()
    
  } catch (error) {
    return res.status(401).send({message: "unthorize email"})
    
  }
 
}



const  admin = require("firebase-admin");

const  serviceAccount = require("./projects-1-full-satck-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const db = client.db("zap-shift")
    const percelSellCollcetion = db.collection("percel-Sell");
    const paymentCollection = db.collection('payment-success');
    const userCollection = db.collection('normal-user');
    const ridersCollection = db.collection('riders');

    // user related api
    app.post('/users', async (req,res)=>{
      const user = req.body
      user.role ='user'
      const email = user.email
      const userExits = await userCollection.findOne({email})
      if(userExits){
        return res.send({massege: "user alreday added"})
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    //riders related api
    app.post('/riders', async(req,res)=>{
      const info =req.body;
      info.status= 'pending'
      info.createAt= new Date();
      const result= await ridersCollection.insertOne(info)
      // console.log(info)
      res.send(result)
    })

    app.get('/riders', async (req,res)=>{
      const query ={}
      if(req.query.status){
        query.status= req.query.status

      }
      const cours = ridersCollection.find(query)
      const result = await cours.toArray()
      res.send(result)
    })
    // rider role model update 
    app.patch('/riders/:id', async(req, res)=>{
       const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const status= req.body.status
      const updateData = {
        $set: {
          status: status
        }
      }
      console.log(updateData);
      const result = await  ridersCollection.updateOne(query,updateData )
      res.send(result)
    })
    

    // rider role rejects api
       app.delete('/riders/:id', async(req, res)=>{
       const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await ridersCollection.deleteOne(query)
      res.send(result)
    })


    // all card show
    app.get('/all-percel', async ( req, res)=>{
      const result = await percelSellCollcetion.find().toArray();
      res.send(result)
      
    })

    // percel sell api
    app.get('/percel', async (req, res) => {
      const query = {}
      const { email } = req.query;
      if (email) {
        query.senderEmail = email
      }
      const options = { sort: { createAt: -1 } }
      const curs = percelSellCollcetion.find(query, options)
      const result = await curs.toArray()
      res.send(result)
    })

    // singel data get
    app.get("/percel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await percelSellCollcetion.findOne(query)
      res.send(result)
    })
    app.post('/percel', async (req, res) => {
      const percel = req.body;
      percel.createAt = new Date()
      // sort 
      const result = await percelSellCollcetion.insertOne(percel)
      res.send(result)
    })

    //
    app.delete('/percel/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await percelSellCollcetion.deleteOne(query)
      res.send(result)
    })

    // payment section
    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo?.cost) * 100
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: paymentInfo?.percelName
              }
            },

            quantity: 1,
          },
        ],
        customer_email: paymentInfo?.senderEmail,
        mode: 'payment',
        metadata: {
          percelId: paymentInfo.percelId,
          percelName: paymentInfo.percelName
        },
        success_url: `${process.env.MY_DOMAIN}dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.MY_DOMAIN}dashboard/payment-canceled?session_id={CHECKOUT_SESSION_ID}`,
      });
      res.send({ url: session.url })
    })
    // payment success check 
    app.patch('/verify-payment-success', async(req, res)=>{
      const sessionId= req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log(session);
      const trackingId= generateTrackingId()
      const transtionId= session.payment_intent;
      const query={transtionId: transtionId};
      const paymentExits =await paymentCollection.findOne(query)
      if(paymentExits){
        return res.send({massege:"alreday payment " , transtionId })
      }
  //  console.log('after session', session);
      if(session.payment_status== 'paid'){
        const id = session.metadata.percelId;
        const query ={ _id: new ObjectId(id)};
        const update ={
          $set:{
            payment_status:'paid',
            trackingId: trackingId
          }
        }  
        const result =await percelSellCollcetion.updateOne({ _id: new ObjectId(id)},update)
        // console.log(result);
       
        const  verifyPaymentInfo={
          amount: session.amount_total/100,
          currency: session.currency,
          customer_email: session.customer_email,
          percelId : session.metadata.percelId,
          percelName: session.metadata.percelName,
          transtionId: transtionId,
          trackingId: trackingId,
          payment_status: session.payment_status,
          paidAt: new Date(),
          
          
        }
        console.log(verifyPaymentInfo);
        
        if(session.payment_status=='paid'){
          
          const result = await paymentCollection.insertOne(verifyPaymentInfo)
          res.send({success:true,trackingId: trackingId, transtionId: transtionId, })
          
        }
        res.send(result)
        
      }
    
      res.send({success: true})
      // res.send(result)

    })

    // payments related api
    app.get('/payment',verifyFbToken, async (req, res)=>{
      const email = req.query.email;
      const query={}  
      if(email){
        query.customer_email= email;
        if(email !== req.decode_email){
          console.log(req.decode_email);
          return res.status(403).send({message:"Authorize email"})
        }
      }
      const result = await paymentCollection.find(query).toArray();
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
