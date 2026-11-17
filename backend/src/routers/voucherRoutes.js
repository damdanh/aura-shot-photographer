const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const protect = require('../middleware/authMiddleware');

router.post('/apply', voucherController.applyVoucher);

router.get('/', protect, protect.restrictTo('admin'), voucherController.getVouchers);
router.post('/', protect, protect.restrictTo('admin'), voucherController.createVoucher);

module.exports = router;