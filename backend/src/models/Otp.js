// backend/src/models/Otp.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Cấu hình TTL Index: Tự động xóa khỏi MongoDB sau 5 phút
  }
});

module.exports = mongoose.model('Otp', otpSchema);