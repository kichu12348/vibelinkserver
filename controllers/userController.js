const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { uploadFile, deleteFile } = require("../utils/uploadToGcp");
const { sendPushNotification } = require("../utils/notificationService");
const {updateUserCache} = require("../middleware/authMiddleware");

let io;

const generateToken = (id) => {
  return jwt.sign({ id }, "your_secret_key");
};

exports.registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      salt,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      followers: user.followers,
      following: user.following,
      profileImage: user.profileImage,
      bio: user.bio,
      token,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const hashedPassword = await bcrypt.hash(password, user.salt);
    const isMatch = hashedPassword === user.password;
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      followers: user.followers,
      following: user.following,
      profileImage: user.profileImage,
      bio: user.bio,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("followers", "username profileImage")
      .populate("following", "username profileImage");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const { username, bio, email, profileImage } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (username) user.username = username;
    if (bio) user.bio = bio;
    if (email) user.email = email;
    if (profileImage) {
      if (user.profileImage) {
        await deleteFile(user.profileImage.split("/").pop());
      }
      const publicUrl = await uploadFile({ name: profileImage });
      user.profileImage = publicUrl;
    }

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      bio: updatedUser.bio,
      profileImage: updatedUser.profileImage,
    });

    // Update the user in the cache
    updateUserCache(updatedUser._id.toString(), {
      _id: updatedUser._id.toString(),
      username: updatedUser.username,
      email: updatedUser.email,
      bio: updatedUser.bio,
      profileImage: updatedUser.profileImage,
    });

    io.emit("userUpdated", {
      userId: updatedUser._id,
      username: updatedUser.username,
      profileImage: updatedUser.profileImage,
      bio: updatedUser.bio,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.followUser = async (req, res) => {
  try {
    if (req.user._id === req.params.id) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (currentUser.following.includes(req.params.id)) {
      return res
        .status(400)
        .json({ message: "You are already following this user" });
    }

    currentUser.following.push(req.params.id);
    userToFollow.followers.push(req.user._id);

    await currentUser.save();
    await userToFollow.save();
    io.emit("userFollowed", {
      followerId: req.user._id,
      followedId: req.params.id,
    });
    sendPushNotification(
      req.params.id,
      "New Follower",
      `${req.user.username} started following you`,
      { type: "follow", userId: req.user._id.toString() }
    );
    res.json({ message: "Successfully followed user" });
  } catch (error) {
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    if (req.user._id === req.params.id) {
      return res.status(400).json({ message: "You cannot unfollow yourself" });
    }

    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToUnfollow || !currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!currentUser.following.includes(req.params.id)) {
      return res
        .status(400)
        .json({ message: "You are not following this user" });
    }

    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== req.params.id
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      (id) => id.toString() !== req.user._id.toString()
    );

    await currentUser.save();
    await userToUnfollow.save();
    io.emit("userUnfollowed", {
      userId: req.user._id,
      unfollowedId: req.params.id,
    });
    res.json({ message: "Successfully unfollowed user" });
  } catch (error) {
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q;
    const query = {
      _id: { $ne: req.user._id }, 
      ...(q ? { username: { $regex: q, $options: "i" } } : {}) 
    };

    const users = await User.find(query)
      .select("username email profileImage bio");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserProfileForPost = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("followers", "username profileImage")
      .populate("following", "username profileImage");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ... Add other controller functions

exports.setIoForUser = (i) => {
  io = i;
};
