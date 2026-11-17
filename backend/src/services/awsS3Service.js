// backend/src/services/awsS3Service.js
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

/**
 * Upload một file buffer lên AWS S3
 * @param {Buffer} fileBuffer 
 * @param {string} key - Đường dẫn file trên S3 (ví dụ: albums/albumId/filename.jpg)
 * @param {string} mimeType 
 * @returns {Promise<string>} S3 Object Key
 */
async function uploadToS3(fileBuffer, key, mimeType) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType
    });
    await s3Client.send(command);
    return key;
}

/**
 * Tạo link Pre-signed URL (link tải ảnh tạm thời) từ S3 Key
 * @param {string} key 
 * @param {number} expiresInSeconds 
 * @returns {Promise<string>} Pre-signed URL
 */
async function getPresignedUrl(key, expiresInSeconds = 3600) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Xóa một file trên S3
 * @param {string} key 
 */
async function deleteFromS3(key) {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    await s3Client.send(command);
}

/**
 * Lấy danh sách toàn bộ ảnh thuộc prefix (ví dụ: albums/albumId) trên S3
 * @param {string} prefix 
 * @returns {Promise<Array>} Danh sách các S3 Objects
 */
async function listObjects(prefix) {
    const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix
    });
    const response = await s3Client.send(command);
    return response.Contents || [];
}
/**
 * Tạo link Pre-signed URL cho Client upload PUT trực tiếp lên S3
 * @param {string} key - S3 Key (đường dẫn lưu trữ)
 * @param {string} contentType - Loại file (ví dụ: image/jpeg)
 * @param {number} expiresInSeconds
 * @returns {Promise<string>} Pre-signed URL để upload
 */
async function getUploadPresignedUrl(key, contentType, expiresInSeconds = 900) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Tải file từ S3 về dưới dạng Buffer (để chạy quét AI khi client upload trực tiếp lên S3)
 * @param {string} key 
 * @returns {Promise<Buffer>}
 */
async function downloadFromS3(key) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    const response = await s3Client.send(command);
    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
}

module.exports = {
    uploadToS3,
    getPresignedUrl,
    getUploadPresignedUrl,
    downloadFromS3,  
    deleteFromS3,
    listObjects,
    s3Client,
    BUCKET_NAME
};
