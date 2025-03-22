const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
        index: true // Index for better query performance
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

messageSchema.index({
    conversation: 1, // Index for better query performance
    createdAt:-1, // Sort messages in a conversation by newest first 
    sender: 1, 
}); // Index for better query performance
messageSchema.index({ 'sharedPost': 1 }); // Index for better query performance
module.exports = mongoose.model('Message', messageSchema);
