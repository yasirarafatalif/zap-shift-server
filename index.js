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
const verifyFbToken = async (req, res, next) => {
  const token = req.headers.authorization;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Unauthoraize User" })
  }
  try {
    const idToken = token.split(' ')[1];
    const decode = await admin.auth().verifyIdToken(idToken);
    // console.log('object', decode);
    req.decode_email = decode.email;
    next()

  } catch (error) {
    return res.status(401).send({ message: "unthorize email" })

  }

}



const admin = require("firebase-admin");

const serviceAccount = require("./projects-1-full-satck-firebase-adminsdk.json");

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


    // verify admin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decode_email;
      const query = { email }
      const user = await userCollection.findOne(query)
      if (user?.role !== "admin") {
        return res.status(403).send('forbiden access')

      }
      next()
      // res.send({success:true})

    }

    // user related api
    app.post('/users', async (req, res) => {
      const user = req.body
      user.role = 'user'
      const email = user.email
      const userExits = await userCollection.findOne({ email })
      if (userExits) {
        return res.send({ massege: "user alreday added" })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })


    //user get related api
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })


    // user role find api
    app.get('/users/:email/role', verifyFbToken, async (req, res) => {
      const email = req.params.email
      const query = { email }
      const user = await userCollection.findOne(query)

      res.send({ role: user?.role || 'user' })
    })


    // user update releted api
    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id
      const roleInfo = req.body;
      const query = { _id: new ObjectId(id) }
      const updateData = {
        $set: {
          role: roleInfo.role
        }
      }

      const result = await userCollection.updateOne(query, updateData)
      res.send(result)
    })


    //riders related api
    app.post('/riders', async (req, res) => {
      const info = req.body;
      info.status = 'pending'
      info.createAt = new Date();
      const result = await ridersCollection.insertOne(info)
      // console.log(info)
      res.send(result)
    })

    app.get('/riders', async (req, res) => {
      const { district, workStatus } = req.query
      const query = {}
      if (req.query.status) {
        query.status = req.query.status

      }
      if (district) {
        query.district = district
      }
      if (workStatus) {
        query.workStatus = workStatus
      }
      // console.log(query);
      const cours = ridersCollection.find(query)
      const result = await cours.toArray()
      // console.log(result);
      res.send(result)
    })
    // rider role model update 
    app.patch('/riders/:id', async (req, res) => {
      const id = req.params.id
      const email = req.body.email
      const query = { _id: new ObjectId(id) }
      const status = req.body.status
      const workStatus = req.body.worKStatus
      const updateData = {
        $set: {
          status: status,
          workStatus: workStatus
        }
      }
      const userQuery = { email: email };
      const riderUpdate = {
        $set: {
          role: 'rider'
        }
      }
      // console.log(updatRole);
      const roleUpdate = await userCollection.updateOne(userQuery, riderUpdate)
      console.log(roleUpdate);
      const result = await ridersCollection.updateOne(query, updateData)
      // console.log(result);
      res.send({
        success: true,
        riderResult: result,
        userRoleUpdated: roleUpdate,
        riderUpdated: riderUpdate
      });

    })


    // rider role rejects api
    app.delete('/riders/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await ridersCollection.deleteOne(query)
      res.send(result)
    })


    // all card show
    app.get('/all-percel', async (req, res) => {
      const result = await percelSellCollcetion.find().toArray();
      res.send(result)

    })

    // percel sell api
    app.get('/percel', async (req, res) => {
      const query = {}
      const { email, deliveryStatus } = req.query;
      if (email) {
        query.senderEmail = email
      }
      if (deliveryStatus) {
        query.deliveryStatus = deliveryStatus
      }
      // console.log(deliveryStatus);

      const options = { sort: { createAt: -1 } }
      const curs = percelSellCollcetion.find(query, options)
      const result = await curs.toArray()
      res.send(result)
    })

    // rider asign task 
    app.get('/percel/rider', async (req, res) => {
      const { riderEmail, deliveryStatus } = req.query;
      const query = {}
      if (deliveryStatus) {
        query.deliveryStatus = { $in: ['rider-assign', 'rider_arriving', 'percel_pickup'] }
      }
      const cours = percelSellCollcetion.find(query)
      const result = await cours.toArray()
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

    // percel patch api
    // app.patch('/percel/:id', async (req, res) => {
    //   const {  name, email, riderId, phoneNumber } = req.body
    //   const id = req.params.id

    //   const query = { _id: new ObjectId(id) }
    //   const updateData = {
    //     $set: {
    //       riderId: riderId,
    //       deliveryStatus: 'rider-assign',
    //       riderName: name,
    //       riderPhoneNumber: phoneNumber,
    //       riderEmail: email,
    //     }
    //   }
    //   console.log(updateData);

    //   const result = await percelSellCollcetion.updateOne(query, updateData)

    //   const riderQureey = { _id: new ObjectId(riderId) }

    //   const riderUpdateData = {
    //     $set: {
    //       workStatus: "in_delivery"

    //     }
    //   }

    //   const rider = await ridersCollection.findOne(riderQureey)

    //   if (rider.workStatus !== "available") {
    //     return res.status(400).send({ message: "Rider not available" })
    //   }
    //   const riderResult = await ridersCollection.updateOne(riderQureey, riderUpdateData)
    //   res.send(result)

    // })


    // percel patch api
    app.patch('/percel/:id', async (req, res) => {
      try {
        const { name, email, riderId, phoneNumber } = req.body;
        const id = req.params.id;

        const parcelQuery = { _id: new ObjectId(id) };
        const riderQuery = { _id: new ObjectId(riderId) };

        // find rider
        const rider = await ridersCollection.findOne(riderQuery);

        if (!rider) {
          return res.status(404).send({ message: "Rider not found" });
        }

        // find rider to workstatus
        if (rider.workStatus !== "available") {
          return res.status(400).send({ message: "Rider not available" });
        }

        //  Parcel Update Data 
        const parcelUpdateData = {
          $set: {
            riderId: riderId,
            deliveryStatus: "rider-assign",
            riderName: name,
            riderPhoneNumber: phoneNumber,
            riderEmail: email,
          }
        };

        //  Rider workStatus update
        const riderUpdateData = {
          $set: {
            workStatus: "in_delivery"
          }
        };

        //  Parcel Update 
        const parcelResult = await percelSellCollcetion.updateOne(parcelQuery, parcelUpdateData);

        //  Rider Update
        const riderResult = await ridersCollection.updateOne(riderQuery, riderUpdateData);

        // ---- Step 7: Final Response ----
        res.send({
          success: true,
          parcelUpdate: parcelResult,
          riderUpdate: riderResult
        });

      } catch (error) {
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });


    //Delivery  status update api
    app.patch('/percel/:id/status', async (req, res) => {
      const { deliveryStatus } = req.body;
      const id = req.params.id
      const deliveryStatusUpdate = {
        $set: {
          deliveryStatus: deliveryStatus
        }
      }
      const query = { _id: new ObjectId(id) }
      const result = await percelSellCollcetion.updateOne(query, deliveryStatusUpdate)
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
    app.patch('/verify-payment-success', async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log(session);
      const trackingId = generateTrackingId()
      const transtionId = session.payment_intent;
      const query = { transtionId: transtionId };
      const paymentExits = await paymentCollection.findOne(query)
      if (paymentExits) {
        return res.send({ massege: "alreday payment ", transtionId })
      }
      //  console.log('after session', session);
      if (session.payment_status == 'paid') {
        const id = session.metadata.percelId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            payment_status: 'paid',
            trackingId: trackingId,
            deliveryStatus: 'pending-pickup',
            amount: session.amount_total / 100,
            currency: session.currency,
            percelId: session.metadata.percelId,
            transtionId: transtionId,
            trackingId: trackingId,
            payment_status: session.payment_status,
            paidAt: new Date(),
          }
        }
        const result = await percelSellCollcetion.updateOne({ _id: new ObjectId(id) }, update)
        console.log(result);
        // console.log(result);

        // const  verifyPaymentInfo={
        //   deliveryStatus: 'pending-pickup',
        //   amount: session.amount_total/100,
        //   currency: session.currency,
        //   customer_email: session.customer_email,
        //   percelId : session.metadata.percelId,
        //   percelName: session.metadata.percelName,
        //   transtionId: transtionId,
        //   trackingId: trackingId,
        //   payment_status: session.payment_status,
        //   paidAt: new Date(),


        // }
        // console.log(verifyPaymentInfo);

        // if(session.payment_status=='paid'){

        //   const result = await paymentCollection.insertOne(verifyPaymentInfo)
        //   res.send({success:true,trackingId: trackingId, transtionId: transtionId, })

        // }
        res.send(result)

      }

      // res.send({success: true})
      // res.send(result)

    })

    // payments related api
    app.get('/payment', verifyFbToken, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      const query = { payment_status: "paid" }
      if (email) {
        query.senderEmail = email;
        if (email !== req.decode_email) {
          console.log(req.decode_email);
          return res.status(403).send({ message: "Authorize email" })
        }
      }


      const result = await percelSellCollcetion.find(query).toArray();
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
