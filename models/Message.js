const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    media: {
        type: {
            type: String,
            enum: ['image', 'video'],
            required: false
        },
        url: {
            type: String,
            required: false
        }
    },
    sharedPost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Update conversation's lastMessage when a new message is created
messageSchema.post('save', async function() {
    await this.model('Conversation').findByIdAndUpdate(
        this.conversation,
        { 
            lastMessage: this.content || 'Shared a media',
            lastMessageAt: this.createdAt
        }
    );
});

module.exports = mongoose.model('Message', messageSchema);
