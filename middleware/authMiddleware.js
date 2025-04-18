const jwt = require("jsonwebtoken");
const User = require("../models/User");

const UserMap = new Map();

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token,"your_jwt_secret_key");
      // Check if the token is already in the map
      const cachedUser = UserMap.get(decoded.id);
      if (cachedUser) {
        req.user = cachedUser;
        return next();
      }
      req.user = await User.findById(decoded.id).select("-password");
      // Cache the user in the map
      UserMap.set(decoded.id, req.user);
      next();
    } catch (error) {
      res.status(401).json({ message: "Not authorized: " + error.message });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

//using promise to update the user cache because the function is async and we need to return a promise
// this is a workaround to avoid using async/await in the middleware

exports.updateUserCache = (userId, userData) => UserMap.set(userId, userData);
