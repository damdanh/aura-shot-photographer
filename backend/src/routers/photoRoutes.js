const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const photoController = require('../controllers/photoController');
const protect = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Sửa lỗi hiển thị tên file có dấu tiếng Việt (mặc định multer/busboy decode theo latin1)
        if (file.originalname) {
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
            // Xóa dấu tiếng Việt, khoảng trắng và ký tự đặc biệt để AWS Rekognition không báo lỗi
            file.originalname = file.originalname.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            file.originalname = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Giới hạn IP chỉ được tìm kiếm mặt tối đa 20 lần / 15 phút
const faceSearchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, 
    message: {
        success: false,
        message: "Bạn đã thực hiện quá nhiều lượt tìm kiếm ảnh khuôn mặt trong thời gian ngắn. Vui lòng thử lại sau 15 phút!"
    }
});

const { checkStorageQuota } = require('../middleware/quotaMiddleware');

// S3 Presigned Upload routes
router.post('/presigned-url', protect, protect.restrictTo('photographer'), protect.checkActiveSass, photoController.getUploadUrl);
router.post('/confirm', protect, protect.restrictTo('photographer'), protect.checkActiveSass, photoController.confirmUpload);

// Upload routes (Server upload)
router.post('/upload', protect, protect.restrictTo('photographer'), protect.checkActiveSass, upload.array('photos', 100), checkStorageQuota, photoController.uploadPhotos);

// Search face routes
router.post('/search-face', faceSearchLimiter, upload.single('selfie'), photoController.searchPhotosByFace);
router.post('/face-search', faceSearchLimiter, upload.single('selfie'), photoController.searchPhotosByFace);

// Cleanup route
router.delete('/clean-all', protect, protect.restrictTo('admin', 'super_admin'), photoController.cleanAllData);

module.exports = router;