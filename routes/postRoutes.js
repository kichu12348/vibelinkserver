const express = require('express');
const router = express.Router();
const { 
    createPost,
    getPosts,
    getPost,
    deletePost,
    likePost,
    unlikePost,
    addComment,
    deleteComment,
    addReply,
    getVibrantColor
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createPost);
router.get('/', protect, getPosts);
router.get('/:id', protect, getPost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, likePost);
router.post('/:id/unlike', protect, unlikePost);
router.post('/:id/comments', protect, addComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);
router.post('/:id/comments/:commentId/replies', protect, addReply);
router.post('/getColor',getVibrantColor);


module.exports = router;
