const express = require('express');
const router = Router = express.Router();
const orderController = require('../controllers/orderController');
const protect = require('../middleware/authMiddleware');

// [GHN] Master Data — Danh sách địa chỉ cho dropdown Frontend
router.get('/shipping/provinces', orderController.getProvinces);
router.get('/shipping/districts', orderController.getDistricts);  // ?province_id=XX
router.get('/shipping/wards', orderController.getWards);          // ?district_id=XX

// Tính phí ship GHN thực tế (phân luồng digital/vật lý tự động)
router.post('/calculate-fee', orderController.calculateFee);

router.get('/customer/history', protect, orderController.getCustomerOrderHistory);
// Thay 'optionalProtect' bằng 'protect' để bắt buộc đăng nhập
router.post('/checkout', protect, orderController.checkout);

// 3. Các API thanh toán
router.patch('/:id/confirm-payment', protect, protect.restrictTo('photographer'), orderController.confirmPayment);
router.patch('/:id/reject-payment', protect, protect.restrictTo('photographer'), orderController.rejectPayment);

// 4. Lấy danh sách các đơn hàng của khách mua tại gian hàng của thợ ảnh (Chỉ thợ ảnh được dùng)
router.get('/', protect, protect.restrictTo('photographer'), orderController.getPhotographerOrders);

// 5. Cập nhật trạng thái xử lý đơn hàng (Chỉ thợ ảnh được dùng)
router.patch('/:id/status', protect, protect.restrictTo('photographer'), orderController.updateOrderStatus);
router.patch('/:id/booking-time', protect, protect.restrictTo('photographer'), orderController.updateBookingTime);

// 6. Bàn giao file ảnh đã Photoshop xong của đơn hàng (Tác vụ 4 - Chỉ thợ ảnh được dùng)
router.post('/:id/delivery', protect, protect.restrictTo('photographer'), orderController.deliverOrder);
// 7. Các API quản lý đơn hàng của Khách hàng
router.get('/:id', protect, orderController.getOrderById);
router.patch('/:id/verify', protect, orderController.markOrderAsVerifying);
router.patch('/:id/cancel', protect, orderController.cancelOrder);
router.patch('/:id/confirm-receipt', protect, orderController.confirmReceipt);


module.exports = router;
