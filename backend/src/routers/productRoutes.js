const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const protect = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../middleware/cache');

router.get('/my-list', protect, protect.restrictTo('photographer'), productController.getMyProducts);
router.get('/featured', cacheMiddleware(300), productController.getFeaturedProducts);
router.get('/', cacheMiddleware(300), productController.getProducts);
router.get('/:id', cacheMiddleware(300), productController.getProductById);
router.post('/', protect, protect.restrictTo('photographer'), protect.checkActiveSass, productController.createProduct);
router.put('/:id', protect, protect.restrictTo('photographer'), protect.checkActiveSass, productController.updateProduct);
router.delete('/:id', protect, protect.restrictTo('photographer', 'admin'), productController.hideProduct);
router.patch('/:id/hide', protect, protect.restrictTo('photographer'), productController.toggleProductActive);
router.patch('/:id/ban', protect, protect.restrictTo('admin', 'super_admin'), productController.banProduct);
router.patch('/admin/:id/ban', protect, protect.restrictTo('admin', 'super_admin'), productController.banProduct);

module.exports = router;
