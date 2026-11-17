const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const googleDriveController = require('../controllers/googleDriveController');
const protect = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const avatarDirectory = path.join(__dirname, '../public/uploads/avatars');
if (!fs.existsSync(avatarDirectory)) fs.mkdirSync(avatarDirectory, { recursive: true });
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, avatarDirectory),
    filename: (req, file, callback) => {
      const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
      callback(null, `avatar-${req.user.id}-${Date.now()}${extensions[file.mimetype]}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    callback(allowed.includes(file.mimetype) ? null : new Error('Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.'), allowed.includes(file.mimetype));
  },
});
const uploadAvatar = (req, res, next) => avatarUpload.single('avatar')(req, res, (error) => {
  if (!error) return next();
  return res.status(400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh đại diện không được lớn hơn 5 MB.' : error.message });
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.sendOtpForgot);
router.post('/reset-password', authController.verifyOtpAndResetPassword);
router.post('/create-client', protect, protect.restrictTo('photographer'), authController.createClient);
router.post('/photographer/create-client', protect, protect.restrictTo('photographer'), authController.createClientByPhotographer || authController.createClient);

router.get('/me', protect, authController.getMe);
router.put('/me', protect, authController.updateMe);
router.post('/me/avatar', protect, uploadAvatar, authController.uploadAvatar);

// Google Drive Link Routes
router.get('/google-drive/connect', protect, protect.restrictTo('photographer'), googleDriveController.connectDrive);
router.get('/google-drive/callback', googleDriveController.callbackDrive);

router.patch('/change-password', protect, authController.changePassword);
router.patch('/update-password', protect, authController.changePassword);

module.exports = router;
