// backend/src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: {
    type: String,
    default: 'system'
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  target_url: {
    type: String,
    default: null
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  review_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    default: null
  },
  album_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Album',
    default: null
  },
  is_read: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);