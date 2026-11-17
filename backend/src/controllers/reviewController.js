// backend/src/controllers/reviewController.js
const Review = require('../models/Review');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');
const Service = require('../models/Service');
const PhotographerProfile = require('../models/PhotographerProfile');
const moderationService = require('../services/moderationService');

// 1. Tạo review cho ĐH hoàn thành
exports.createReview = async (req, res) => {
    try {
        const { order_id, rating, comment } = req.body;
        const userId = req.user.id;

        if (!order_id || !rating) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp mã đơn hàng và số sao đánh giá"
            });
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Số sao phải trong khoảng từ 1 đến 5"
            });
        }
        // Kiểm tra đơn hàng có tồn tại không
        const order = await Order.findById(order_id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng này trên hệ thống"
            });
        }
        // Chỉ khách hàng đặt đơn mới được đánh giá
        if (order.user_id && order.user_id.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền đánh giá đơn hàng của người khác!'
            });
        }
        // Chỉ đơn hàng đã thanh toán và hoàn tất mới được đánh giá
        const validStatuses = ['paid', 'processing', 'delivered', 'completed'];
        if (!validStatuses.includes(order.status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Bạn chỉ được đánh giá đơn hàng này sau khi đã thanh toán thành công!'
            });
        }
        // Kiểm tra xem đơn hàng này đã được đánh giá chưa
        const exitsingReview = await Review.findOne({ order_id });
        if (exitsingReview) {
            return res.status(400).json({
                success: false,
                message: "Đơn hàng này đã được đánh giá trước đó"
            });
        }
        // Truy vấn thợ chụp ảnh sở hữu các sản phẩm/dịch vụ trong đơn hàng này
        const orderItem = await OrderItem.findOne({ order_id: order._id });
        let photographer_id;
        if (orderItem) {
            if (orderItem.item_type === 'service' && orderItem.service_id) {
                const svc = await Service.findById(orderItem.service_id);
                if (svc) photographer_id = svc.user_id;
            } else if (orderItem.product_id) {
                const prod = await Product.findById(orderItem.product_id);
                if (prod) photographer_id = prod.user_id;
            }
        }
        if (!photographer_id) {
            return res.status(400).json({
                success: false,
                message: 'Không xác định được thợ chụp ảnh sở hữu đơn hàng này!'
            });
        }
        // Kiểm duyệt tự động bình luận bằng AI Badwords
        let isSafe = true;
        let aiNote = null;
        if (comment && comment.trim() !== "") {
            const textMod = moderationService.checkText(comment);
            if (textMod.isViolated) {
                isSafe = false;
                aiNote = `Bình luận chứa từ ngữ nhạy cảm vi phạm quy chuẩn: "${textMod.matchedWord}"`;
            }
        }
        // Tạo bản ghi đánh giá
        const review = await Review.create({
            order_id,
            customer_id: userId,
            photographer_id,
            rating,
            comment,
            is_safe: isSafe,
            ai_moderation_note: aiNote
        });
        // Nếu bình luận an toàn, tính toán lại điểm số trung bình của thợ ảnh
        if (isSafe) {
            await updatePhotographerRating(photographer_id);
        }
        // Tạo thông báo cho thợ ảnh và Admin (nếu bị đánh giá thấp)
        const Notification = require('../models/Notification');
        const User = require('../models/User');

        let title = 'Đánh giá mới';
        let message = `Khách hàng vừa để lại đánh giá ${rating} sao cho gian hàng của bạn.`;
        let notifType = 'new_review';
        
        if (rating <= 2) {
            title = 'Cảnh báo đánh giá thấp';
            message = `Bạn vừa nhận đánh giá ${rating} sao từ khách hàng. Vui lòng xem lại chất lượng dịch vụ để tránh bị Admin nhắc nhở hoặc khóa tài khoản!`;
            notifType = 'warning';

            // Báo cáo cho toàn bộ Admin tổng
            const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
            const adminNotifications = admins.map(admin => ({
                user_id: admin._id,
                type: 'warning',
                target_url: `/admin/users`,
                title: 'Thợ ảnh bị đánh giá thấp',
                message: `Một thợ ảnh vừa bị khách hàng đánh giá ${rating} sao. Vui lòng kiểm tra lại chất lượng dịch vụ của gian hàng này.`
            }));
            if (adminNotifications.length > 0) {
                await Notification.insertMany(adminNotifications);
            }
        }

        const newNotification = await Notification.create({
          user_id: photographer_id,
          type: notifType,
          review_id: review._id,
          target_url: `/photographer/reviews`,
          title: title,
          message: message
        });
        
        if (req.app.locals.io) {
          req.app.locals.io.to(photographer_id.toString()).emit('notification', newNotification);
        }

        return res.status(201).json({
            success: true,
            message: isSafe ? "Cảm ơn bạn đã đánh giá dịch vụ" :
                "Đánh giá của bạn đã được gửi nhưng bình luận đang bị tạm khoá do chứa từ ngữ nhạy cảm!",
            data: review
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi tạo đánh giá: " + error.message
        });
    }
};

// Lấy danh sách đánh giá của một thợ ảnh (công khai)
exports.getPhotographerReviews = async (req, res) => {
    try {
        const { photographerId } = req.params;
        const review = await Review.find({ photographer_id: photographerId, is_safe: true, is_banned: false })
            .populate('customer_id', 'full_name avatar_url')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, count: review.length, data: review });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống lấy danh sách đánh giá: " + error.message });
    }
};

// Lấy review của 1 đơn hàng cụ thể
exports.getReviewByOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const review = await Review.findOne({ order_id: orderId })
            .populate('customer_id', 'full_name avatar_url')
            .populate('photographer_id', 'full_name avatar_url email');
        return res.status(200).json({ success: true, data: review });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi lấy đánh giá đơn hàng: " + error.message });
    }
};

// Lấy toàn bộ review của khách hàng hiện tại
exports.getMyReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ customer_id: req.user.id })
            .populate('photographer_id', 'full_name avatar_url email')
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi lấy danh sách đánh giá: " + error.message });
    }
};

// Phản hồi đánh giá của khách hàng (Dành cho Thợ ảnh)
exports.replyReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply_text } = req.body;
        const photographerId = req.user.id;

        if (!reply_text || !reply_text.trim()) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập nội dung phản hồi!" });
        }

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá này!" });
        }

        if (review.photographer_id.toString() !== photographerId.toString()) {
            return res.status(403).json({ success: false, message: "Bạn không có quyền phản hồi đánh giá này!" });
        }

        const photographerName = req.user.full_name || "Nhiếp ảnh gia";
        const photographerAvatar = req.user.avatar_url || null;

        review.reply = {
            comment: reply_text.trim(),
            created_at: new Date(),
            photographer_name: photographerName,
            photographer_avatar: photographerAvatar
        };

        await review.save();

        // Gửi thông báo đến Khách hàng đã đánh giá
        const Notification = require('../models/Notification');
        const shortReply = reply_text.length > 60 ? reply_text.substring(0, 60) + '...' : reply_text;
        
        const customerNotification = await Notification.create({
            user_id: review.customer_id,
            type: 'new_review',
            review_id: review._id,
            target_url: '/user/order-history',
            title: 'Nhiếp ảnh gia đã phản hồi đánh giá',
            message: `${photographerName} vừa phản hồi đánh giá của bạn: "${shortReply}"`
        });

        if (req.app.locals.io) {
            req.app.locals.io.to(review.customer_id.toString()).emit('notification', customerNotification);
        }

        return res.status(200).json({
            success: true,
            message: "Phản hồi đánh giá thành công!",
            data: review
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi phản hồi đánh giá: " + error.message });
    }
};

// Xóa phản hồi đánh giá (Dành cho Thợ ảnh)
exports.deleteReply = async (req, res) => {
    try {
        const { id } = req.params;
        const photographerId = req.user.id;

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá này!" });
        }

        if (review.photographer_id.toString() !== photographerId.toString()) {
            return res.status(403).json({ success: false, message: "Bạn không có quyền thao tác trên đánh giá này!" });
        }

        review.reply = undefined;
        await review.save();

        return res.status(200).json({
            success: true,
            message: "Đã xóa phản hồi thành công!",
            data: review
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi xóa phản hồi: " + error.message });
    }
};

// Hàm phụ trợ tính toán lại số sao và số lượt đánh giá
async function updatePhotographerRating(photographerId) {
    const review = await Review.find({ photographer_id: photographerId, is_safe: true, is_banned: false });
    const count = review.length;
    let average = 0;

    if (count > 0) {
        const sum = review.reduce((acc, curr) => acc + curr.rating, 0);
        average = Math.round((sum / count) * 10) / 10;
    }
    await PhotographerProfile.findOneAndUpdate(
        { user_id: photographerId },
        { rating_average: average, rating_count: count },
        { new: true, upsert: true }
    );
}
