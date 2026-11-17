const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, protect.restrictTo('customer', 'photographer'), reviewController.createReview);
router.post('/:id/reply', protect, protect.restrictTo('photographer'), reviewController.replyReview);
router.delete('/:id/reply', protect, protect.restrictTo('photographer'), reviewController.deleteReply);

router.get('/order/:orderId', protect, reviewController.getReviewByOrder);
router.get('/my-reviews', protect, reviewController.getMyReviews);
router.get('/photographer/:photographerId', reviewController.getPhotographerReviews);
module.exports = router;