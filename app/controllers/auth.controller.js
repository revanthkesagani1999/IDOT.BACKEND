const config = require("../config/auth.config");
const db = require("../models");
const nodemailer = require('nodemailer');
const User = db.user;
const Role = db.role;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

// Updated signup function using async/await
exports.signup = async (req, res) => {
  try {
    const user = new User({
      username: req.body.username,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 8),
    });

    const savedUser = await user.save();

    if (req.body.roles) {
      const roles = await Role.find({
        name: { $in: req.body.roles },
      });
      savedUser.roles = roles.map(role => role._id);
    } else {
      const role = await Role.findOne({ name: "user" });
      savedUser.roles = [role._id];
    }

    await savedUser.save();
    res.send({ message: "User was registered successfully!" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.signin = async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.body.username,
    }).populate("roles", "-__v").exec();

    if (!user) {
      return res.status(404).send({ message: "User Not found." });
    }

    var passwordIsValid = bcrypt.compareSync(req.body.password, user.password);

    if (!passwordIsValid) {
      return res.status(401).send({ message: "Invalid Password!" });
    }

    var token = jwt.sign({ id: user.id }, config.secret, {
      expiresIn: 86400, // 24 hours
    });

    var authorities = [];
    for (let i = 0; i < user.roles.length; i++) {
      authorities.push("ROLE_" + user.roles[i].name.toUpperCase());
    }
    
    req.session.token = token;

    res.status(200).send({
      id: user._id,
      username: user.username,
      email: user.email,
      roles: authorities,
      token: token
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// exports.signout = async (req, res) => {
//   try {
//     req.session = null;
//     res.status(200).send({ message: "You've been signed out!" });
//   } catch (err) {
//     res.status(500).send({ message: err.message });
//   }
// };

exports.signout = async (req, res) => {
  try {
    req.session = null;

    // If you are setting a cookie name in your session middleware, clear it like this:
    res.clearCookie('bezkoder-session');  // Use the name of your session cookie here

    res.status(200).send({ message: "You've been signed out!" });
  } catch (err) {
    console.error("Error during logout:", err);
    res.status(500).send({ message: err.message });
  }
};


// Forgot password function
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).exec();
    if (!user) {
      return res.status(400).send({ message: 'User with this email does not exist.' });
    }

    var token = jwt.sign({ id: user._id }, config.resetPasswordSecret, { expiresIn: '1h' });
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Setup Nodemailer transport
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'k.revanthgoud903@gmail.com',
        pass: 'gkrh egjf rzmp gtvc'
      }
    });

    let mailOptions = {
      from: 'no-reply@yourdomain.com',
      to: user.email,
      subject: 'Password Reset Link',
      html: `
        <p>Please click on the following link, or paste this into your browser to complete the process:</p>
        <p>Note: The link is only valid for 1 hour.</p>
        <a href="https://idot-ui.vercel.app/#/reset-password/${token}">Reset Password</a>
      `
    };
    console.log(`https://idot-ui.vercel.app/#/reset-password/${token}`);
    await transporter.sendMail(mailOptions);
    res.status(200).send({ message: 'A reset link has been sent to ' + user.email + '.' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// Reset password function
exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    }).exec();

    if (!user) {
      return res.status(400).send({ message: 'Password reset token is invalid or has expired.' });
    }

    user.password = bcrypt.hashSync(req.body.newPassword, 8);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).send({ message: 'Your password has been updated.' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};
