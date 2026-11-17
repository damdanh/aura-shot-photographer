const { unique } = require('@tensorflow/tfjs');
const mongoose = require('mongoose');

const photographerProfileSchema = new mongoose.Schema({
   user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
   },
   storeName: {
      type: String,
      default: "",
      trim: true
   },
   slug: {
      type: String,
      trim: true,
      index: { unique: true, sparse: true }
   },
   bio: {
      type: String,
      default: ""
   },
   cover_image_url: {
      type: String,
      default: null
   },
   skills: [{
      type: String
   }], 
   is_verified: {
      type: Boolean,
      default: false
   },
   location: {
      type: String,
      default: "Sài Gòn",
      trim: true
   },
   phone: {
      type: String,
      default: "",
      trim: true
   },
   busy_dates: [{
      type: String
   }],
   busy_slots: [{
      date: { type: String, required: true }, // Format: YYYY-MM-DD
      start_time: { type: String, required: true }, // Format: HH:mm
      end_time: { type: String, required: true }, // Format: HH:mm
      note: { type: String, default: "" }
   }],
   bank_name: {
      type: String,
      default: ""
   },
   bank_account_number: {
      type: String,
      default: ""
   },
   bank_account_name: {
      type: String,
      default: ""
   },
   experience: {
      type: String,
      default: "Chưa cập nhật kinh nghiệm"
   },
   average_rating: {
      type: Number,
      default: 0
   },
   review_count: {
      type: Number,
      default: 0
   },
   operating_hours: {
      start: { type: String, default: "06:00" }, // HH:mm – giờ bắt đầu nhận lịch
      end:   { type: String, default: "22:00" }  // HH:mm – giờ kết thúc nhận lịch
   }
}, { timestamps: true });

module.exports = mongoose.model('PhotographerProfile', photographerProfileSchema);