const express = require("express");
const SocketIo = require("socket.io");
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const postRoutes = require('./routes/postRoutes');
const fileUpload = require('express-fileupload');
const path = require('path');
const {setIoForUser} = require('./controllers/userController');
const {setIoForPost} = require('./controllers/postController');
const {setIoForMessage, handleSocketEvents} = require('./controllers/messageController');

const app = express();

// Middleware
app.use(express.json());

// File upload middleware
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));

app.get("/", (req, res) => {
    res.json({ message: "Server is running" });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});

// Socket.IO setup
const io = SocketIo(server);

setIoForUser(io);
setIoForPost(io);
setIoForMessage(io);

io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("join", (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
    });

    // Add message socket handlers
    handleSocketEvents(socket);

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

