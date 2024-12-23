const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

let io;

// Get or create conversation between users
const getOrCreateConversation = async (participants) => {
    try {
        let conversation = await Conversation.findOne({
            type: 'private',
            'participants.user': { $all: participants }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                type: 'private',
                participants: participants.map(userId => ({
                    user: userId,
                    unreadCount: 0
                }))
            });
        }

        return conversation;
    } catch (error) {
        console.error('Create conversation error:', error);
        throw error;
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, content, conversationId } = req.body;
        const senderId = req.user._id;

        let conversation;
        
        if (conversationId) {
            // If existing conversation
            conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
        } else if (receiverId) {
            // Create new conversation
            conversation = await getOrCreateConversation([senderId, receiverId]);
        } else {
            return res.status(400).json({ message: 'Either conversationId or receiverId is required' });
        }

        // Create message
        const message = await Message.create({
            conversation: conversation._id,
            sender: senderId,
            content
        });

        // Update conversation
        await conversation.updateLastMessage({
            content,
            sender: senderId,
            type: 'text'
        });

        // Populate sender details
        await message.populate('sender', 'username profileImage');
        await conversation.populate('participants.user', 'username profileImage');

        // Emit to all participants
        conversation.participants.forEach(participant => {
            if (participant.user._id.toString() !== senderId.toString()) {
                io.to(participant.user._id.toString()).emit('newMessage', {
                    message,
                    conversation
                });
            }
        });

        res.status(201).json({
            message,
            conversation
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            'participants.user': userId
        })
        .populate('participants.user', 'username profileImage')
        .populate('lastMessage.sender', 'username')
        .sort({ updatedAt: -1 });

        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching conversations' });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        // Get messages without conversation verification first
        const messages = await Message.find({ conversation: conversationId })
            .populate('sender', 'username profileImage')
            .populate('sharedPost')
            .sort({ createdAt: 1 });

        if (!messages) {
            return res.status(404).json({ message: 'No messages found' });
        }

        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findOne({
            _id: messageId,
            sender: userId
        });

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        await message.remove();

        // Update conversation's last message if needed
        const lastMessage = await Message.findOne({
            conversation: message.conversation
        }).sort({ createdAt: -1 });

        if (lastMessage) {
            await message.conversation.updateLastMessage(lastMessage);
        }

        res.json({ message: 'Message deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting message' });
    }
};

exports.createGroupChat = async (req, res) => {
    try {
        const { name, participants } = req.body;
        const userId = req.user._id;

        // Create group conversation
        const conversation = await Conversation.create({
            type: 'group',
            participants: [...participants, userId].map(id => ({
                user: id
            })),
            groupDetails: {
                name,
                admins: [userId]
            }
        });

        await conversation.populate('participants.user', 'username profileImage');

        res.status(201).json(conversation);
    } catch (error) {
        res.status(500).json({ message: 'Error creating group chat' });
    }
};


exports.setIoForMessage = (i) => {
    io = i;
};

// Add this new function for socket events
exports.handleSocketEvents = (socket) => {
    socket.on('joinChat', (conversationId) => {
        socket.join(`chat:${conversationId}`);
    });

    socket.on('leaveChat', (conversationId) => {
        socket.leave(`chat:${conversationId}`);
    });
};