const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.olgdgso.mongodb.net/?appName=Cluster0;`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // jobs api
    const jobsCollection = client.db("JObLagvbe").collection("jobs");
    const applicationsCollection = client.db("JObLagvbe").collection("applications");


    // job api
    app.get('/jobs', async (req, res) => {
        const cursor = jobsCollection.find()
        const result = await cursor.toArray()
        res.send(result)

    })

    // Find specific job by id
    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await jobsCollection.findOne(query)
      res.send(result)
    } )


    // Job application api
    app.post('/applications', async (req, res) => {
      const application = req.body
      console.log(application);
      const result = await applicationsCollection.insertOne(application)
      res.send(result)
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job lagbe cooking");
});

app.listen(port, () => {
  console.log(`Career Code server is running on port ${port}`);
});
