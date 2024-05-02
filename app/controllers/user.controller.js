const db = require("../models");
const User = db.user;

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

exports.saveModel = async (req, res) => {
  const { category, modelYear, size, subcategory, fueltype, equipment } = req.body;
  const userId = req.userId;

  try {
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }

    // Add the model information to the user's savedModels array
    const modelData = JSON.stringify({ category, modelYear, size, subcategory, fueltype, equipment });
    user.savedModels.push(modelData);

    // Save the updated user document
    await user.save();
    res.status(200).send({ message: "Model saved successfully." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};


exports.getAllModels = async (req, res) => {
  const userId = req.userId;

  try {
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }

    res.status(200).send({ savedModels: user.savedModels });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

