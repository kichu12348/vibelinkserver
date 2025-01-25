const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { uploadFile, deleteFile } = require("../utils/uploadToGcp");
const { sendPushNotification } = require("../utils/notificationService");

let io;

// Get or create conversation between users
const getOrCreateConversation = async (participants) => {
  try {
    let conversation = await Conversation.findOne({
      type: "private",
      "participants.user": { $all: participants },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        type: "private",
        participants: participants.map((userId) => ({
          user: userId,
          unreadCount: 0,
        })),
      });
    }

    return conversation;
  } catch (error) {
    console.log("Create conversation error:", error);
    throw error;
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, conversationId, media, sharedPost } = req.body;
    const senderId = req.user._id;

    let conversation;

    if (conversationId) {
      // If existing conversation
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
    } else if (receiverId) {
      // Create new conversation
      conversation = await getOrCreateConversation([senderId, receiverId]);
    } else {
      return res
        .status(400)
        .json({ message: "Either conversationId or receiverId is required" });
    }

    // Create message
    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      content,
      media: media ? { type: "image", url: media } : undefined,
      sharedPost: sharedPost || undefined,
    });

    // Update conversation
    await conversation.updateLastMessage({
      content: content || (sharedPost ? "Shared a post" : "Sent an image"),
      sender: senderId,
      type: sharedPost ? "post" : media ? "image" : "text",
    });

    // Populate sender and post details
    await message.populate([
      { path: "sender", select: "username profileImage" },
      {
        path: "sharedPost",
        populate: { path: "user", select: "username profileImage" },
        populate: {
          path: "comments.user",
          select: "username profileImage"
        },
        populate: {
          path: "comments.replies.user",
          select: "username profileImage"
        },
        populate: {
          path:"likes",
          select: "username profileImage"
        },
      },
    ]);
    await conversation.populate("participants.user", "username profileImage");

    // Emit to all participants
    conversation.participants.forEach((participant) => {
      if (participant.user._id.toString() !== senderId.toString()) {
        io.to(participant.user._id.toString()).emit("newMessage", {
          message,
          conversation,
        });
      }
    });

    // Send push notification to receiver
    conversation.participants.forEach(async (participant) => {
      if (participant.user._id.toString() !== senderId.toString()) {
        await sendPushNotification(
          participant.user._id,
          message.sender.username || "New message",
          content || "Sent you a message",
          {
            conversationId: conversation._id,
            receiverId: participant.user._id,
            username: participant.user.username,
            profileImage: req.user.profileImage,
            participants: conversation.participants,
          }
        );
      }
    });
    io.to(`chat:${conversation._id.toString()}`).emit("userStopTyping", {
      userId: senderId,
    });

    res.status(201).json({
      message,
      conversation,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      "participants.user": userId,
    })
      .populate("participants.user", "username profileImage")
      .populate("lastMessage.sender", "username")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: "Error fetching conversations" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId, topMessageId } = req.params;
    const limit = 10;

    let query = { conversation: conversationId };

    if (topMessageId && topMessageId !== "nope") {
      const topMessage = await Message.findById(topMessageId);
      if (!topMessage) {
        return res.status(404).json({ message: "Top message not found" });
      }

      query.createdAt = { $lt: topMessage.createdAt };
    }

    const messages = await Message.find(query)
      .populate([
        { path: "sender", select: "username profileImage" },
        {
          path: "sharedPost",
          populate: { path: "user", select: "username profileImage" },
          populate: {
            path: "comments.user",
            select: "username profileImage"
          },
          populate: {
            path: "comments.replies.user",
            select: "username profileImage"
          },
        },
      ])
      .sort({ createdAt: -1 }) // Sort by latest first
      .limit(limit); // Limit the results to 10

    res.json(messages.reverse());
  } catch (error) {
    console.log("Get messages error:", error.message);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      sender: userId,
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const conversation = await Conversation.findById(
      message.conversation
    ).populate("participants.user");

    await Message.findByIdAndDelete(messageId);
    if (message.media) {
      if (message.media.url) {
        await deleteFile(message.media.url.split("/").pop());
      }
    }

    if (conversation) {
      conversation.participants.forEach((participant) => {
        if (participant.user._id.toString() !== userId.toString()) {
          io.to(participant.user._id.toString()).emit("deletedMessage", {
            messageId,
          });
        }
      });
    }

    // Update conversation's last message if needed
    const lastMessage = await Message.findOne({
      conversation: message.conversation,
    }).sort({ createdAt: -1 });

    if (lastMessage) {
      conversation.lastMessage = lastMessage;
      await conversation.save();
    }
    res.json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ message: `server error: ${error.message}` });
  }
};

exports.createGroupChat = async (req, res) => {
  try {
    const { name, participants } = req.body;
    const userId = req.user._id;

    // Create group conversation
    const conversation = await Conversation.create({
      type: "group",
      participants: [...participants, userId].map((id) => ({
        user: id,
      })),
      groupDetails: {
        name,
        admins: [userId],
      },
    });

    await conversation.populate("participants.user", "username profileImage");

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ message: "Error creating group chat" });
  }
};

exports.uploadFileToGCPBucket = async (req, res) => {
  try {
    const { filename } = req.body;
    const url = await uploadFile({ name: filename });
    res.status(201).json({ url });
  } catch (error) {
    res
      .status(500)
      .json({ message: `error uploading to GCP: ${error.message}` });
  }
};

exports.setIoForMessage = (i) => {
  io = i;
};

// Add this new function for socket events
exports.handleSocketEvents = (socket) => {
  socket.on("joinChat", (conversationId) => {
    socket.join(`chat:${conversationId}`);
  });

  socket.on("leaveChat", (conversationId) => {
    socket.leave(`chat:${conversationId}`);
  });

  socket.on("typing", ({ conversationId, userId }) => {
    socket.to(`chat:${conversationId}`).emit("userTyping", { userId });
  });

  socket.on("stopTyping", ({ conversationId, userId }) => {
    socket.to(`chat:${conversationId}`).emit("userStopTyping", { userId });
  });
};
