const express = require('express');
const router = express.Router();
const { 
    registerUser, 
    loginUser, 
    getUserProfile,
    updateUserProfile,
    followUser,
    unfollowUser,
    searchUsers,
    getUserProfileForPost
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile/:id', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/follow/:id', protect, followUser);
router.post('/unfollow/:id', protect, unfollowUser);
router.get('/search', protect, searchUsers);
router.get('/:id', protect, getUserProfileForPost);

router.post('/push-token', protect, async (req, res) => {
    try {
        const { token } = req.body;
        await User.findByIdAndUpdate(req.user._id, { expoPushToken: token });
        res.status(200).json({ message: 'Push token saved' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
 
module.exports = router;
