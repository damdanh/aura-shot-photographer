const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const protect = require('../middleware/authMiddleware');

// 1. Lấy danh sách khách hàng đã mua của thợ chụp (Thợ ảnh)
router.get('/customers', protect, protect.restrictTo('photographer'), statsController.getStoreCustomers);

// 2. Xem biểu đồ doanh thu, số đơn bán ra của riêng thợ chụp (Thợ ảnh)
router.get('/stats', protect, protect.restrictTo('photographer'), statsController.getStoreStats);

module.exports = router;
