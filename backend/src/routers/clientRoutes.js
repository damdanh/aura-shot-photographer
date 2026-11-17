const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const protect = require('../middleware/authMiddleware');

// Áp dụng middleware bảo mật cho tất cả các định tuyến bên dưới
router.use(protect);
// Chỉ cho phép tài khoản có role là 'photographer'
router.use(protect.restrictTo('photographer'));

// POST /api/photographer/clients - Tạo tài khoản Khách hàng định danh
router.post('/', clientController.createClientAccount);

// GET /api/photographer/clients - Lấy danh sách Khách hàng của riêng thợ ảnh đó
router.get('/', clientController.getMyClients);

module.exports = router;
