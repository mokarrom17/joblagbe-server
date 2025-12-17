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

    const jobsCollection = client.db("JObLagvbe").collection("jobs");
    const applicationsCollection = client
      .db("JObLagvbe")
      .collection("applications");

    // jobs api
    // =============================================================================================

    //  Get all jobs (optionally filtered by HR email)
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      const query = {};

      // Apply email filter if provided
      if (email) {
        query["company.hr_email"] = email;
      }

      const cursor = jobsCollection.find(query); // pass the query here
      const result = await cursor.toArray();
      res.send(result);
    });

    // Could be done
    /*app.get("/jobsByEmailAddress", async (req, res) =>{
      const email = req.query.email;
      const query = {hr_email: email}
      const result = await jobsCollection.find(query).toArray();
      res.send(result)
    })*/

    // Get a single job by its MongoDB ObjectId
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // Add a new job to the database
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      console.log(newJob);
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    // ===================================================================
    // APPLICATIONS API
    // ===================================================================

    // Get all applications for a specific job
    app.get("/applications/job/:id", async (req, res) => {
      const job_id = req.params.id;
      console.log(job_id);
      const query = { jobId: job_id };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    // Submit a new job application
    app.post("/applications", async (req, res) => {
      const application = req.body;
      console.log(application);
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    // Update application status (e.g. Pending, Hired, Rejected)
    app.patch("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(req.params.id) };
      const updatedDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await applicationsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // ==============================================================================================
    // USER APPLICATIONS API
    // ==============================================================================================

      // Get all applications submitted by a specific user
    app.get("/my-applications", async (req, res) => {
      const email = req.query.email;

      // Find applications by applicant email
      const query = {
        applicant: email,
      };

      const result = await applicationsCollection.find(query).toArray();

       // Attach job details to each application
      for (const application of result) {
        const jobId = application.jobId;
        const jobQuery = { _id: new ObjectId(jobId) };
        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
        application.company = job.company;
        application.title = job.title;
        application.logo = job.logo;
      }
      res.send(result);
    });


     // ==================================================================================
    // MongoDB Health Check
    // ===================================================================================

    // Verify MongoDB connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
// Start server and handle errors
run().catch(console.dir);


// ======================================================================================
// Root Route
// ======================================================================================

// Default API route
app.get("/", (req, res) => {
  res.send("Job lagbe cooking");
});

// ======================================================================================
// Server Listener
// ======================================================================================

// Start listening on defined port
app.listen(port, () => {
  console.log(`Career Code server is running on port ${port}`);
});
