const mongoose = require('mongoose');

const frameSizeSchema = new mongoose.Schema({
  size_label: {
    type: String,
    required: true // ví dụ: '10x15', 'A4', '20x30'
  },
  price: {
    type: Number,
    required: true
  }
}, { _id: false });

const frameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  photographer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sizes: {
    type: [frameSizeSchema],
    default: []
  },
  description: {
    type: String,
    default: ''
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Frame', frameSchema);
