const express = require('express');
const router = express.Router();
const { 
    sendMessage,
    getConversations,
    getMessages,
    deleteMessage,
    uploadFileToGCPBucket,
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendMessage);
router.get('/conversations', protect, getConversations);
router.get('/:conversationId', protect, getMessages);
router.delete('/:messageId', protect, deleteMessage);
router.post('/upload', protect, uploadFileToGCPBucket);

module.exports = router;
