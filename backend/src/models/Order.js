const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete');

const orderSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  orderCode: {
    type: Number,
    default: null,
    unique: true,
    sparse: true
  },
  photographer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  service_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: null
  },
  customer_name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  shipping_address: {
    type: String,
    default: null
  },
  total_amount: {
    type: Number,
    required: true
  },
  deposit_amount: {
    type: Number,
    default: 0
  },
  remaining_amount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Verifying', 'Deposit Paid', 'Paid', 'Processing', 'Delivered', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  selected_images: [
    {
      image_url: {
        type: String,
        required: true
      },
      customer_note: {
        type: String,
        default: ""
      }
    }
  ],
  delivered_urls: {
    type: [String],
    default: []
  },
  proof_of_delivery_link: {
    type: String,
    default: null
  },
  note: {
    type: String,
    default: ""
  },
  booking_date: {
    type: String,
    default: null
  },
  related_order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  }
}, {
  timestamps: true
});

orderSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Order', orderSchema);
