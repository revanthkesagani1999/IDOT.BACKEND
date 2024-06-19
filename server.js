const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");

const dbConfig = require("./app/config/db.config");


const path = __dirname + '/app/views/';
const app = express();
app.use((req, res, next) => {
  console.log(`Incoming ${req.method} request for ${req.url}`);
  next();
});

app.use(express.static(path));

var corsOptions = {
  origin: "https://idot-ui-revanth1999s-projects.vercel.app",
  methods: ["POST", "GET", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],  // Ensure to include any custom headers you use
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
    res.status(200).end();
});
// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
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

// simple route
app.get("/", (req, res) => {
  res.sendFile(path + "index.html");
});

// routes
require("./app/routes/auth.routes")(app);
require("./app/routes/user.routes")(app);

// set port, listen for requests
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
