const express = require("express");
const SocketIo = require("socket.io");
const mongoose = require("mongoose");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const postRoutes = require("./routes/postRoutes");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const { setIoForUser } = require("./controllers/userController");
const { setIoForPost } = require("./controllers/postController");
const {
  setIoForMessage,
  handleSocketEvents,
} = require("./controllers/messageController");
const { setIoForStory } = require("./controllers/storyController");
const { getNumberOfAll } = require("./controllers/publicController");
const { startHappyNotifs } = require("./utils/happyNotifs");
const storyRoutes = require("./routes/storyRoutes");
const { sendAnnouncementToAll } = require("./utils/notificationService");

const app = express();

// Middleware
app.use(express.json());

app.use("/", express.static(path.join(__dirname, "public"),{index: false})); // Serve static files

// File upload middleware
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/stories", storyRoutes);

app.get("/", async (req, res) => {
  const { users, posts, messages } = await getNumberOfAll();
  fs.readFile(
    path.join(__dirname, "public", "index.html"),
    "utf8",
    (err, data) => {
      if (err) {
        res.status(500).send("Server error");
      } else {
        res.send(
          data
            .replace("{{users}}", users)
            .replace("{{posts}}", posts)
            .replace("{{messages}}", messages)
        );
      }
    }
  );
});

app.get("/api/latest-app-version-link", (req, res) => {
  const latestAppVersionLink = null;
  res.json({ link: latestAppVersionLink });
});

app.get("/api/anouncement", (req, res) => {
  const html = fs.readFileSync(
    path.join(__dirname, "public", "anouncement.html"),
    "utf8"
  );
  res.send(html);
});

app.post("/api/anouncement", async (req, res) => {
  const { title, body } = req.body;
  await sendAnnouncementToAll(title, body);
  res.status(200).json({ message: "Announcement sent to all users." });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
  startHappyNotifs();
});

// Socket.IO setup
const io = SocketIo(server);

setIoForUser(io);
setIoForPost(io);
setIoForMessage(io);
setIoForStory(io);

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    socket.join(userId);
  });

  // Add message socket handlers
  handleSocketEvents(socket);
});
