const mongoose = require('mongoose');
const { deleteFile } = require('../utils/uploadToGcp');

const mediaSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // 24 hours
    }
});

const storySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    media: [mediaSchema],
    color:{
        type: String,
        default: "#FF6B6B",
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Update lastUpdated when media is added
storySchema.pre('save', function(next) {
    this.lastUpdated = Date.now();
    next();
});

// Cleanup files before story is completely removed
storySchema.pre('remove', async function(next) {
    try {
        for (const media of this.media) {
            const fileName = media.url.split('/').pop();
            await deleteFile(fileName);
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Cleanup files when media items expire
storySchema.methods.cleanupExpiredMedia = async function() {
    const currentTime = Date.now();
    const expiredMedia = this.media.filter(m => 
        (new Date(m.createdAt).getTime() + 24 * 60 * 60 * 1000) <= currentTime
    );

    for (const media of expiredMedia) {
        const fileName = media.url.split('/').pop();
        await deleteFile(fileName);
    }
};

module.exports = mongoose.model('Story', storySchema);
