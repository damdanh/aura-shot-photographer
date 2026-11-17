const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [
    {
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
      // [Tác vụ 1 & 3] album_id và image_url là OPTIONAL (required: false)
      // Hỗ trợ cả 2 luồng: bán sản phẩm lẻ (không ảnh) và order ảnh từ album
      album_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Album', 
        required: false,
        default: null 
      },
      image_url: { 
        type: String, 
        required: false,
        default: null 
      },
      photo_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Photo',
        required: false,
        default: null
      },
      booking_date: {
        type: String,
        require: true,
        default: null
      },
      quantity: { 
        type: Number, 
        required: true, 
        default: 1 
      },
      createdAt: { 
        type: Date, 
        default: Date.now 
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
