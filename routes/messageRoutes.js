const express = require('express');
const router = express.Router();
const { 
    sendMessage,
    getConversations,
    getMessages,
    deleteMessage
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendMessage);
router.get('/conversations', protect, getConversations);
router.get('/:conversationId', protect, getMessages);
router.delete('/:messageId', protect, deleteMessage);

module.exports = router;
