const mongoose = require('mongoose');

const packageSchema = new 
mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    max_albums: {
        type: Number,
        required: true
    },
    // [MỚI - Tác vụ 1] Giới hạn số sản phẩm/dịch vụ thợ ảnh được phép đăng theo gói
    max_products: {
        type: Number,
        required: true,
        default: 0
    },
    price: {
        type: Number,
        required: true
    },
    duration_days: { type: Number, required: true, default: 30, min: 0 },
    storage_gb: { type: Number, required: true, default: 5, min: -1 },
    max_photos: { type: Number, required: true, default: 100, min: -1 },
    features: { type: [String], default: [] },
    is_active: { type: Boolean, default: true }
}, {timestamps: true}); // tự động tạo createdAt và updateAt

module.exports = mongoose.model('Package', packageSchema);
