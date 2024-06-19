const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const app = express();

const path = __dirname + '/app/views/';
app.use(express.static(path));

// Detailed CORS and preflight handling
var corsOptions = {
  origin: "https://idot-ui-revanth1999s-projects.vercel.app",
  methods: ["POST", "GET", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options("*", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "https://idot-ui-revanth1999s-projects.vercel.app",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true"
  });
  console.log("Handling OPTIONS request for CORS");
  res.status(200).end();
});

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`Incoming ${req.method} request for ${req.url}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: "bezkoder-session",
    secret: "COOKIE_SECRET", // should use as secret environment variable
    httpOnly: true
  })
);

const db = require("./app/models");
const modeldataconnection = require("./app/models").data;
const Role = db.role;

db.mongoose
  .connect("mongodb+srv://rkesagani:Revanth1999@idotcluster.ejuamcb.mongodb.net/?retryWrites=true&w=majority", {
    // // useNewUrlParser: true,
    // useUnifiedTopology: true
  })
  .then(() => {
    console.log("Successfully connect to MongoDB.");
    initial();
  })
  .catch(err => {
    console.error("Connection error", err);
    process.exit();
  });

app.get("/", (req, res) => {
  res.sendFile(path + "index.html");
});

// Route configurations
require("./app/routes/auth.routes")(app);
require("./app/routes/user.routes")(app);

// Set port, listen for requests
const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

async function initial() {
  try {
    const count = await Role.estimatedDocumentCount();
    if (count === 0) {
      // Create roles if they don't exist
      await new Role({ name: "user" }).save();
      console.log("added 'user' to roles collection");

      // new Role({
      //   name: "moderator"
      // }).save(err => {
      //   if (err) {
      //     console.log("error", err);
      //   }

      //   console.log("added 'moderator' to roles collection");
      // });

      await new Role({ name: "admin" }).save();
      console.log("added 'admin' to roles collection");
    }
  } catch (err) {
    console.error("Error initializing the database roles", err);
  }
}
