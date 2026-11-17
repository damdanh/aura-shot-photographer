const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Voucher = require('./src/models/Voucher');

async function seedVoucher() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Check if voucher exists
  let v = await Voucher.findOne({ code: 'DATN2026' });
  if (!v) {
    v = await Voucher.create({
      code: 'DATN2026',
      discount_type: 'fixed',
      discount_value: 50000,
      min_order_value: 0,
      usage_limit: 100,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2028-01-01'),
      is_active: true
    });
    console.log('Tạo Voucher test thành công:', v.code);
  } else {
    console.log('Voucher test đã tồn tại:', v.code);
  }
  process.exit(0);
}
seedVoucher();
