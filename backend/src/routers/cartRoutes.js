const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

const protect = require('../middleware/authMiddleware');

router.post('/add', protect, cartController.addToCart);
router.get('/', protect, cartController.getCart)
router.delete('/items/:itemId', protect, cartController.removeCartItem)
router.delete('/', protect, cartController.clearCart)

module.exports = router;
