const express = require('express');
const router = express.Router();
const albumController = require('../controllers/albumController');
const protect = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

// Middleware xác thực không bắt buộc để phục vụ việc trích xuất user (nếu có)
const optionalProtect = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch (error) {
    // Bỏ qua lỗi token để coi như khách vãng lai
  }
  next();
};

// Route định nghĩa cho Album
router.post('/create', protect, protect.restrictTo('photographer'), protect.checkActiveSass, albumController.createAlbum);
router.post('/', protect, protect.restrictTo('photographer'), protect.checkActiveSass, albumController.createAlbum);

// Route public cho Landing Page
router.get('/public/trending', albumController.getTrendingAlbums);

router.get('/my-list', protect, protect.restrictTo('photographer'), albumController.getMyAlbums);
router.get('/client-list', protect, protect.restrictTo('customer', 'photographer'), albumController.getClientAlbums);
router.get('/', protect, protect.restrictTo('photographer'), albumController.getMyAlbumsWithQuery);
const rateLimit = require('express-rate-limit');

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 lần thử sai từ 1 IP
  message: { success: false, message: "Bạn đã nhập mã PIN quá nhiều lần. Vui lòng thử lại sau 15 phút!" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/verify-pin', pinLimiter, optionalProtect, albumController.verifyAlbumPin);
router.post('/:id/access', protect, protect.restrictTo('photographer', 'admin', 'super_admin'), albumController.grantAlbumAccess);
router.delete('/:album_id', protect, protect.restrictTo('photographer', 'admin', 'super_admin'), albumController.deleteAlbum); 
router.post('/:id/sync-drive', protect, protect.restrictTo('photographer'), albumController.syncGoogleDrive);
router.patch('/:id/ban', protect, protect.restrictTo('admin', 'super_admin'), albumController.banAlbum);
router.patch('/admin/:id/ban', protect, protect.restrictTo('admin', 'super_admin'), albumController.banAlbum);
router.get('/:id/photos', optionalProtect, albumController.getAlbumPhotos);
router.patch('/:id', protect, protect.restrictTo('photographer'), albumController.updateAlbum);
router.patch('/:id/toggle-lock', protect, protect.restrictTo('photographer'), albumController.toggleLock);
router.patch('/:id/toggle-public', protect, protect.restrictTo('photographer'), albumController.togglePublic);
router.post('/:id/submit-selection', optionalProtect, albumController.submitSelection);

module.exports = router;