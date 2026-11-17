// backend/src/models/UserPackage.js
const mongoose = require('mongoose');

const userPackageSchema = new mongoose.Schema({
  package_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Package', 
    required: true 
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  started_at: { 
    type: Date, 
    required: true 
  },
  expired_at: { 
    type: Date, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'expired', 'cancelled', 'pending_payment'], 
    default: 'active' 
  },
  price_paid: {
    type: Number,
    required: true,
    default: 0
  },
  order_code: {
    type: Number,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('UserPackage', userPackageSchema);