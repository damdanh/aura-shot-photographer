const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const protect = require('../middleware/authMiddleware');

router.get('/', packageController.getPackages);
router.get('/my-subscription', protect, protect.restrictTo('photographer'), packageController.getMySubscription);
router.get('/subscriptions', protect, protect.restrictTo('admin', 'super_admin'), packageController.getAllSubscriptions);

router.post('/subscribe', protect, protect.restrictTo('photographer'), packageController.subscribePackage);
router.post('/webhook/payos', packageController.payosWebhook);

// Admin duyệt thủ công khi thợ ảnh thanh toán chuyển khoản
router.patch('/subscriptions/:subscriptionId/approve', protect, protect.restrictTo('admin', 'super_admin'), packageController.approveSubscription);

module.exports = router;

