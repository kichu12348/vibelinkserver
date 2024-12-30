const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const TEMP_DIR = path.join(__dirname, '../temp');

// Ensure directories exist
!fs.existsSync(UPLOAD_DIR) && fs.mkdirSync(UPLOAD_DIR);
!fs.existsSync(TEMP_DIR) && fs.mkdirSync(TEMP_DIR);

exports.uploadChunk = async (req, res) => {
    try {
        const { fileName, chunkIndex, totalChunks } = req.body;
        const chunk = req.files.file;
        
        const tempFilePath = path.join(TEMP_DIR, `${fileName}.part${chunkIndex}`);
        await chunk.mv(tempFilePath);

        // If this is the last chunk, combine all chunks
        if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
            const finalFilePath = path.join(UPLOAD_DIR, fileName);
            const writeStream = fs.createWriteStream(finalFilePath);

            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = path.join(TEMP_DIR, `${fileName}.part${i}`);
                const chunkBuffer = await fs.promises.readFile(chunkPath);
                writeStream.write(chunkBuffer);
                await fs.promises.unlink(chunkPath); // Clean up chunk
            }

            writeStream.end();
        }

        res.json({ success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error uploading chunk' });
    }
};

exports.deleteFile = async (req, res) => {
    try {
        const { fileName } = req.body;
        const filePath = path.join(UPLOAD_DIR, fileName);
        await
        fs
        .promises
        .unlink(filePath);
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting file' });
    }
}
//     } catch (error) {
exports.finalizeUpload = async (req, res) => {
    try {
        const { fileName } = req.body;
        const tempDir = path.join(TEMP_DIR, fileName);
        const uploadDir = path.join(UPLOAD_DIR, fileName);
        await fs.promises.rename(tempDir, uploadDir);
        res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error finalizing upload' });
    }
}
