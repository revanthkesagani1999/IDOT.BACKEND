const db = require("../models");
exports.allAccess = (req, res) => {
  res.status(200).send("Public Content.");
};

exports.userBoard = (req, res) => {
  res.status(200).send("User Content.");
};

exports.adminBoard = (req, res) => {
  res.status(200).send("Admin Content.");
};

exports.moderatorBoard = (req, res) => {
  res.status(200).send("Moderator Content.");
};
const User = db.user;
exports.saveModel = (req, res) => {
  const { category, modelYear, size, subcategory, fueltype, equipment } = req.body;
  const userId = req.userId;

  User.findById(userId, (err, user) => {
    if (err) {
      res.status(500).send({ message: err });
      return;
    }

    if (!user) {
      res.status(404).send({ message: "User not found." });
      return;
    }

    // Add the model information to the user's savedModels array
    const modelData = JSON.stringify({ category, modelYear, size, subcategory, fueltype, equipment });
    user.savedModels.push(modelData);

    // Save the updated user document
    user.save((err) => {
      if (err) {
        res.status(500).send({ message: err });
        return;
      }

      res.status(200).send({ message: "Model saved successfully." });
    });
  });
};

exports.getAllModels = (req, res) => {
  const userId = req.userId;

  User.findById(userId, (err, user) => {
    if (err) {
      res.status(500).send({ message: err });
      return;
    }

    if (!user) {
      res.status(404).send({ message: "User not found." });
      return;
    }

    res.status(200).send({ savedModels: user.savedModels });
  });
};

