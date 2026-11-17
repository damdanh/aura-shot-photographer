const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete');

const serviceSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Liên kết tới User sở hữu dịch vụ
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  price: {
    type: Number,
    required: true
  },
  image_url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['shooting', 'editing', 'other'],
    default: 'shooting'
  },
  shooting_category: {
    type: String,
    enum: ['wedding', 'portrait', 'event', 'fashion', 'brand', 'outdoor', 'graduation', 'other'],
    default: 'other'
  },
  duration: {
    type: String,
    default: null // Ví dụ: "3 tiếng", "1 ngày"
  },
  gallery: [{
    type: String
  }],
  max_people: {
    type: Number,
    default: 2
  },
  delivered_photos_count: {
    type: Number,
    default: 30
  },

  delivery_time: {
    type: String,
    default: "3-5 ngày sau khi chụp"
  },
  location: {
    type: String,
    default: ""
  },
  package_includes: [{
    type: String
  }],
  cancellation_policy: {
    type: String,
    default: "Hủy trước 3 ngày hoàn 100% tiền cọc, hủy trong vòng 3 ngày hoàn 50%"
  },
  auto_delete_album_days: {
    type: Number,
    default: null // null means keep forever
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_featured: {
    type: Boolean,
    default: false // Đưa dịch vụ lên nổi bật ở trang profile
  },
  is_banned: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'pending'],
    default: 'active'
  },
  is_safe: {
    type: Boolean,
    default: true
  },
  ai_moderation_note: {
    type: String,
    default: null
  },
  restored_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Tích hợp plugin xóa mềm (Soft Delete)
serviceSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Service', serviceSchema);
