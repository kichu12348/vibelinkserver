const {Storage} = require('@google-cloud/storage');
const  fs = require('fs');
const path = require('path');

const storage = new Storage({
    keyFilename: "keys.json",
});

const bucketName = "vibe-link-public";
const bucket = storage.bucket(bucketName);



const deleteFileFromUploads = (file) => {
    const filePath = path.join(__dirname, `../uploads/${file}`);
    fs.unlink(filePath, (err) => {
        if (err) console.log("Error removing file:", err.message);
    });
};

async function uploadFile(file) {
    try {
        const filePath = `uploads/${file.name}`;
        const buffer = fs.readFileSync(filePath);
        const blob = bucket.file(file.name);
        
        return new Promise((resolve, reject) => {
            const blobStream = blob.createWriteStream({
                resumable: false,
                metadata: {
                    contentType: "image/jpeg"
                }
            });

            blobStream.on("error", (err) => {
                console.log("Error uploading file:", err);
                reject(err);
            });

            blobStream.on("finish", () => {
                const publicUrl = `https://storage.googleapis.com/${bucketName}/${file.name}`;
                deleteFileFromUploads(file.name);
                resolve(publicUrl);
            });

            blobStream.end(buffer);
        });

    } catch (error) {
        console.log("Upload error:", error.message);
    }
}

const deleteFile = async (file) => {
    try {
        const blob = bucket.file(file);
        await blob.delete();
    } catch (error) {
        console.log("Error deleting file:", error.message);
    }   
}



module.exports = {uploadFile,deleteFile};