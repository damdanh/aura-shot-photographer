const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storeController = require('../controllers/storeController');
const protect = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../middleware/cache');

const avatarDirectory = path.join(__dirname, '../public/uploads/avatars');
if (!fs.existsSync(avatarDirectory)) {
    fs.mkdirSync(avatarDirectory, { recursive: true });
}

const avatarStorage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, avatarDirectory),
    filename: (req, file, callback) => {
        const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
        callback(null, `avatar-${req.user.id}-${Date.now()}${extensions[file.mimetype]}`);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error('Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.'));
        }
        callback(null, true);
    }
});

const uploadSingleAvatar = (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (error) => {
        if (!error) return next();
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Ảnh đại diện không được lớn hơn 5 MB.'
            : error.message;
        return res.status(400).json({ success: false, message });
    });
};

const bannerDirectory = path.join(__dirname, '../public/uploads/banners');
if (!fs.existsSync(bannerDirectory)) {
    fs.mkdirSync(bannerDirectory, { recursive: true });
}

const bannerStorage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, bannerDirectory),
    filename: (req, file, callback) => {
        const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
        callback(null, `banner-${req.user.id}-${Date.now()}${extensions[file.mimetype] || '.jpg'}`);
    }
});

const bannerUpload = multer({
    storage: bannerStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error('Ảnh bìa chỉ hỗ trợ JPG, PNG, WebP hoặc GIF.'));
        }
        callback(null, true);
    }
});

const uploadSingleBanner = (req, res, next) => {
    bannerUpload.single('banner')(req, res, (error) => {
        if (!error) return next();
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Ảnh bìa không được lớn hơn 10 MB.'
            : error.message;
        return res.status(400).json({ success: false, message });
    });
};

router.get('/api/stores', cacheMiddleware(300), storeController.getPublicStores);
router.get('/api/stores/featured', cacheMiddleware(300), storeController.getFeaturedStores);
router.get('/api/stores/search', cacheMiddleware(60), storeController.searchStores); 
router.post('/api/stores/me/avatar', protect, protect.restrictTo('photographer'), uploadSingleAvatar, storeController.uploadAvatar);
router.post('/api/stores/me/banner', protect, protect.restrictTo('photographer'), uploadSingleBanner, storeController.uploadBanner);
router.get('/api/stores/:slug', cacheMiddleware(300), storeController.getStoreBySlug);
router.put('/api/stores/me', storeController.updateMyStore);
router.put('/api/stores/me/busy-dates', storeController.updateBusyDates);
router.get('/api/stores/:id/calendar', storeController.getUnavailableCalendar);

module.exports = router;
