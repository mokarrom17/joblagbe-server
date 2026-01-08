const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 3000;
require("dotenv").config();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://joblagbe-b552e.web.app",
      "https://joblagbe-b552e.firebaseapp.com",
    ],
    credentials: true,
  })
);

// handle preflight
app.options("*", cors());

app.use(express.json());
app.use(cookieParser());

// const logger = (req, res, next) => {
//   console.log("inside the logger Middleware");
//   next();
// };

// const verifyToken = (req, res, next) => {
//   const token = req?.cookies?.token;
//   console.log("cookie in the Middleware :", token);
//   next();
// };

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.olgdgso.mongodb.net/?appName=Cluster0;`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Firebase Admin SDK initialization
const admin = require("firebase-admin");
// const serviceAccount = require("./joblagbe-firebase-admin-key.json");
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("decoded token", decoded);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const veryTokenEmail = async (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: " forbidden access" });
  }
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    if (!client.topology?.isConnected()) {
      await client.connect();
    }

    const jobsCollection = client.db("JObLagvbe").collection("jobs");
    const applicationsCollection = client
      .db("JObLagvbe")
      .collection("applications");
    const blogsCollection = client.db("JObLagvbe").collection("blogs");
    // =============================================================================================
    // jwt token related api
    // app.post("/jwt", async (req, res) => {
    //   const userData = req.body;
    //   const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
    //     expiresIn: "1h",
    //   });
    //   // set token in the cookies
    //   res.cookie("token", token, {
    //     httpOnly: true,
    //     secure: false,
    //   });
    //   res.send({ success: true });
    // });
    // ==============================================================================================
    // jobs api
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query["company.hr_email"] = email;
      }
      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    //  Get all jobs (optionally filtered by HR email)
    app.get(
      "/jobsByEmailAddress",
      verifyFirebaseToken,
      veryTokenEmail,
      async (req, res) => {
        try {
          const email = req.query.email;

          const jobs = await jobsCollection
            .aggregate([
              {
                $match: {
                  "company.hr_email": email,
                },
              },
              {
                $lookup: {
                  from: "applications",
                  localField: "_id",
                  foreignField: "jobId",
                  as: "applications",
                },
              },
              {
                $addFields: {
                  application_count: { $size: "$applications" },
                },
              },
              {
                $project: {
                  title: 1,
                  jobLevel: 1,
                  jobType: 1,
                  deadline: 1,
                  company: 1,
                  application_count: 1,
                },
              },
            ])
            .toArray();

          res.send(jobs);
        } catch (error) {
          console.error("jobsByEmailAddress ERROR:", error);
          res.status(500).send([]);
        }
      }
    );

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
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    // ===================================================================
    // APPLICATIONS API
    // ===================================================================

    // Get all applications for a specific job
    app.get("/applications/job/:id", async (req, res) => {
      const job_id = req.params.id;
      const query = { jobId: new ObjectId(job_id.toString()) };
      // ✔ FIXED
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    // Submit a new job application
    app.post("/applications", async (req, res) => {
      const application = {
        ...req.body,
        jobId: new ObjectId(req.body.jobId), // FIXED (convert string → ObjectId)
        status: "Pending",
      };

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
    app.get(
      "/applications",
      verifyFirebaseToken,
      veryTokenEmail,

      async (req, res) => {
        const email = req.query.email;

        // console.log("inside applications api", req.headers);

        const query = {
          applicant: email,
        };
        const result = await applicationsCollection.find(query).toArray();

        // bad way to aggregate data
        for (const application of result) {
          const jobId = application.jobId;
          const jobQuery = { _id: new ObjectId(jobId.toString()) };

          const job = await jobsCollection.findOne(jobQuery);
          application.company = job.company;
          application.title = job.title;
          application.company_logo = job.company_logo;
        }

        res.send(result);
      }
    );

    // ===================================================================
    // BLOGS API
    // ===================================================================

    app.get("/blogs", async (req, res) => {
      try {
        const blogs = await blogsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(blogs);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // BlogDetails by Id
    app.get("/blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const blog = await blogsCollection.findOne({ _id: new ObjectId(id) });

        if (!blog) {
          return res.status(404).send({ message: "Blog not found" });
        }
        res.send(blog);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // ==================================================================================
    // MongoDB Health Check
    // ===================================================================================

    // Verify MongoDB connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
// app.listen(port, () => {
//   console.log(`Career Code server is running on port ${port}`);
// });
module.exports = app;
