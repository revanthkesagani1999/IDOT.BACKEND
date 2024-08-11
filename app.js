require('dotenv').config(); // Ensure this is at the top to load environment variables early

const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");

const dbConfig = require("./app/config/db.config");

const app = express();
const path = __dirname + '/app/views/';

app.use(express.static(path));

const corsOptions = {
  origin: ["http://localhost:4200", "https://idot-ui.vercel.app"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieSession({
    name: "bezkoder-session",
    secret: process.env.COOKIE_SECRET, // Use environment variable for the secret
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Enable secure cookies in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // Set to 'strict' if you want to restrict to same site
    path: '/' // Explicitly set the path if needed
}));

const db = require("./app/models");
const modeldataconnection = require("./app/models").data;
const Role = db.role;

db.mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Successfully connected to MongoDB.");
    initial();
  })
  .catch(err => {
    console.error("Connection error", err);
    process.exit();
  });

require("./app/routes/auth.routes")(app);
require("./app/routes/user.routes")(app);

const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

async function initial() {
  const count = await Role.estimatedDocumentCount();
  if (count === 0) {
    console.log("Initializing roles...");
    await new db.Role({ name: "user" }).save();
    await new db.Role({ name: "moderator" }).save();
    await new db.Role({ name: "admin" }).save();
    console.log("Roles initialized.");
  }
}
