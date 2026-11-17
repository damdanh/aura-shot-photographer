
const mongoose = require('mongoose');

const customerAlbumAccessSchema = new mongoose.Schema({
  album_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Album',
    required: true 
},
  customer_email: { 
    type: String, 
    required: true
},
  customer_name: { 
    type: String, 
    required: false
},
  customer_phone: { 
    type: String, 
    required: false
},
  is_finalized: { 
    type: Boolean, 
    default: false 
}, // Đã bấm nút chốt danh sách ảnh lựa chọn chưa
  accessed_at: { 
    type: Date, 
    default: Date.now 
}
}, { timestamps: true });

module.exports = mongoose.model('CustomerAlbumAccess', customerAlbumAccessSchema);