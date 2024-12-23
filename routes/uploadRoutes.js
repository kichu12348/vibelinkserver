const express = require('express');
const router = express.Router();
const path = require('path');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const file = req.files.file;
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.name)}`;
        const uploadPath = path.join(__dirname, '../uploads', fileName);

        await file.mv(uploadPath);
        res.json({ fileName });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

module.exports = router;
