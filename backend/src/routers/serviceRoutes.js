const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const protect = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../middleware/cache');

router.get('/my-list', protect, protect.restrictTo('photographer'), serviceController.getMyServices);
router.get('/featured', cacheMiddleware(300), serviceController.getFeaturedServices);
router.get('/', cacheMiddleware(300), serviceController.getServices);
router.get('/:id', cacheMiddleware(300), serviceController.getServiceById);
router.post('/', protect, protect.restrictTo('photographer'), protect.checkActiveSass, serviceController.createService);
router.put('/:id', protect, protect.restrictTo('photographer'), protect.checkActiveSass, serviceController.updateService);
router.delete('/:id', protect, protect.restrictTo('photographer', 'admin'), serviceController.hideService);
router.patch('/:id/hide', protect, protect.restrictTo('photographer'), serviceController.toggleServiceActive);
router.patch('/:id/ban', protect, protect.restrictTo('admin', 'super_admin'), serviceController.banService);
router.patch('/admin/:id/ban', protect, protect.restrictTo('admin', 'super_admin'), serviceController.banService);

module.exports = router;
