const express = require("express");
const SocketIo = require("socket.io");
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const postRoutes = require('./routes/postRoutes');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const {setIoForUser} = require('./controllers/userController');
const {setIoForPost} = require('./controllers/postController');
const {setIoForMessage, handleSocketEvents} = require('./controllers/messageController');
const {setIoForStory} = require('./controllers/storyController');
const {getNumberOfAll} = require('./controllers/publicController');
const {startHappyNotifs}=require('./utils/happyNotifs');
const storyRoutes = require('./routes/storyRoutes');

const app = express();

// Middleware
app.use(express.json());

// File upload middleware
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/stories', storyRoutes);

app.get("/", async (req, res) => {
    const {users,posts,messages} = await getNumberOfAll();
    fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8', (err, data) => {
        if (err) {
            res.status(500).send("Server error");
        } else {
            res.send(data.replace("{{users}}", users).replace("{{posts}}", posts).replace("{{messages}}", messages));
        }
    });
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

