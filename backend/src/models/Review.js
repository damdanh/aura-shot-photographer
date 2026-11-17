// backend/src/models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        unique: true
    },
    customer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    photographer_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        default: ""
    },
    is_safe: {
        type: Boolean,
        default: true
    },
    ai_moderation_note: {
        type: String,
        default: null
    },
    is_banned: {
        type: Boolean,
        default: false // Đổi về Boolean để khớp với hàm tìm kiếm reviews
    },
    reply: {
        comment: { type: String, default: null },
        created_at: { type: Date, default: null },
        photographer_name: { type: String, default: null },
        photographer_avatar: { type: String, default: null }
    }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
