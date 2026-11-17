const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  item_type: {
    type: String,
    enum: ['product', 'service'],
    default: 'product',
    required: true
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', 
    default: null
  },
  service_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service', 
    default: null
  },
  // [Tác vụ 1] Các trường này là OPTIONAL — hỗ trợ bán sản phẩm lẻ không cần ảnh từ album
  image_url: {
    type: String,
    required: false,
    default: null
  },
  album_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Album',
    required: false,
    default: null
  },
  photo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo',
    required: false,
    default: null
  },
  // Hỗ trợ dịch vụ in khung ảnh vật lý
  frame_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Frame',
    required: false,
    default: null
  },
  frame_size: {
    type: String,
    required: false,
    default: null
  },
  frame_price: {
    type: Number,
    required: false,
    default: 0
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  unit_price: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OrderItem', orderItemSchema);