const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const Photo = require('../models/Photo');
const Notification = require('../models/Notification');
const awsRekognitionService = require('../services/awsRekognitionService');
const moderationService = require('../services/moderationService');

// Kết nối tới cơ sở dữ liệu Redis
const redisOptions = {
    maxRetriesPerRequest: null
};

if (process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss://')) {
    redisOptions.tls = {
        rejectUnauthorized: false
    };
}

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', redisOptions);

// 1. Khởi tạo Queue
const photoQueue = new Queue('photo-ai-processing', { connection: redisConnection });

// 2. Khởi tạo Worker để xử lý tác vụ
const worker = new Worker('photo-ai-processing', async (job) => {
    const { photoId, s3Key, albumId, albumName, userId } = job.data;
    console.log(`[Queue Worker] Đang xử lý ảnh ID: ${photoId}`);

    const photo = await Photo.findById(photoId);
    if (!photo) return;

    // 2.1. Đánh chỉ mục khuôn mặt (AWS Rekognition)
    const collectionId = `album_${albumId}`;
    let detectedFaces = [];
    try {
        detectedFaces = await awsRekognitionService.indexFacesInPhoto(collectionId, s3Key);
    } catch (awsError) {
        console.error(`[Worker AWS] Lỗi quét mặt:`, awsError.message);
    }

    // 2.2. Kiểm duyệt nội dung (Google Vision)
    // Tải ảnh từ S3 về để lấy Buffer cho Google Vision
    const awsS3Service = require('../services/awsS3Service');
    let isPhotoBanned = false;
    try {
        const fileBuffer = await awsS3Service.downloadFromS3(s3Key);
        isPhotoBanned = await moderationService.checkImageViolation(fileBuffer);
    } catch (visionError) {
        console.error(`[Worker Vision] Lỗi quét nội dung:`, visionError.message);
    }

    // 2.3. Cập nhật cơ sở dữ liệu
    photo.face = detectedFaces.map(f => ({ box: f.box, descriptor: [] }));
    photo.is_banned = isPhotoBanned;
    await photo.save();

    // 2.4. Gửi thông báo nếu vi phạm
    if (isPhotoBanned) {
        await Notification.create({
            user_id: userId,
            title: 'Ảnh vi phạm chính sách',
            message: `Ảnh "${photo.file_name}" trong Album "${albumName}" bị AI phát hiện vi phạm chính sách và đã bị ẩn.`
        });
    }
    console.log(`[Queue Worker] Đã hoàn thành xử lý ảnh: ${photo.file_name}`);
}, { 
    connection: redisConnection, 
    concurrency: 3,
    // [FIX] Tối ưu cho Redis Cloud: Giảm tần suất Worker đi quét các job bị kẹt từ 30s xuống 5 phút (300000ms)
    // Giúp tiết kiệm lượng lớn Request bắn lên Redis khi không có tác vụ nào
    stalledInterval: 300000,
    metrics: { maxDataPoints: 1 } 
});

module.exports = { photoQueue };
