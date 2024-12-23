const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['private', 'group'],
        default: 'private',
        required: true
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        unreadCount: {
            type: Number,
            default: 0
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    groupDetails: {
        name: String,
        description: String,
        avatar: String,
        admins: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    },
    lastMessage: {
        content: String,
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        type: {
            type: String,
            enum: ['text', 'image', 'post'],
            default: 'text'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for better query performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ 'participants.user': 1, updatedAt: -1 });

// Update timestamp before saving
conversationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Helper methods
conversationSchema.methods = {
    // Add participant to conversation
    addParticipant: async function(userId) {
        if (!this.participants.some(p => p.user.toString() === userId.toString())) {
            this.participants.push({ user: userId });
            return await this.save();
        }
    },

    // Remove participant from conversation
    removeParticipant: async function(userId) {
        this.participants = this.participants.filter(
            p => p.user.toString() !== userId.toString()
        );
        return await this.save();
    },

    // Update unread count for a participant
    updateUnreadCount: async function(userId, increment = true) {
        const participant = this.participants.find(
            p => p.user.toString() === userId.toString()
        );
        if (participant) {
            participant.unreadCount = increment 
                ? participant.unreadCount + 1 
                : 0;
            return await this.save();
        }
    },

    // Update last message
    updateLastMessage: async function(message) {
        this.lastMessage = {
            content: message.content,
            sender: message.sender,
            type: message.type || 'text',
            timestamp: new Date()
        };
        return await this.save();
    }
};

module.exports = mongoose.model('Conversation', conversationSchema);
