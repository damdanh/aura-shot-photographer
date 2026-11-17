const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
 code: {
  type: String,
  required: true,
  unique: true,
  uppercase: true,
  trim: true
 },
 discount_type: {
  type: String,
  enum: ['percent', 'fixed'],
  required: true
 },
 discount_value: {
  type: Number,
  required: true
 },
 max_discount_amount: {
  type: Number,
  default: null
 },
 min_order_value: {
  type: Number,
  default: 0
 },
 usage_limit: {
  type: Number,
  default: 100
 },
 used_count: {
  type: Number,
  default: 0
 },
 start_date: {
  type: Date,
  required: true
 },
 end_date: {
  type: Date,
  required: true
 },
 is_active: {
  type: Boolean,
  default: true
 }
}, {
  timestamps: true
});
module.exports = mongoose.model('Voucher', voucherSchema);
