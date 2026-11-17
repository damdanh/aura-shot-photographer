const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete');

const productSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Liên kết tới User sở hữu sản phẩm
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  image_url: {
    type: String,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_featured: {
    type: Boolean,
    default: false // Đưa sản phẩm lên gian hàng nổi bật ở trang profile công khai
  },
  // [MỚI - Tác vụ 1] Phân biệt sản phẩm vật lý (cần giao hàng) và dịch vụ số (không cần ship)
  is_physical: {
    type: Boolean,
    default: false
  },
  description:{
    type: String,
    default: ""
  },
  gallery: [{
    type: String
  }],
  stock: {
    type: Number,
    default: 100
  },
  dimensions: {
    type: String,
    default: ""
  },
  material: {
    type: String,
    default: ""
  },
  return_policy: {
    type: String,
    default: "Đổi trả miễn phí trong vòng 7 ngày nếu sản phẩm có lỗi từ nhà sản xuất hoặc hư hỏng trong quá trình vận chuyển"
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
productSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Product', productSchema);
