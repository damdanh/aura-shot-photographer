/**
 * Script sửa lại gói dịch vụ cho thợ ảnh Đoàn Thái Bảo:
 * - Hủy tất cả các gói sai (pending_payment hoặc active bị kích hoạt nhầm khi chưa thanh toán)
 * - Giữ lại gói active hợp lệ cũ nhất (nếu có)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const UserPackage = require('../models/UserPackage');
const User = require('../models/User');
const Package = require('../models/Package');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'aura-shot-datn' });
  
  const email = 'baodoan20060106@gmail.com';
  const user = await User.findOne({ email });
  if (!user) {
    console.log('Không tìm thấy user:', email);
    await mongoose.disconnect();
    return;
  }
  
  console.log(`\nUser: ${user.full_name} (${user.email})`);
  console.log(`Current package_id on User model: ${user.package_id}`);
  
  // Liệt kê tất cả gói subscription
  const allSubs = await UserPackage.find({ user_id: user._id })
    .populate('package_id')
    .sort({ createdAt: -1 });
  
  console.log(`\nTổng cộng ${allSubs.length} bản ghi UserPackage:`);
  allSubs.forEach((sub, i) => {
    const pkgName = sub.package_id?.name || 'Unknown';
    const price = sub.package_id?.price || 0;
    console.log(`  ${i + 1}. [${sub.status}] ${pkgName} (${price}đ) - Tạo: ${sub.createdAt?.toISOString()} - order_code: ${sub.order_code || 'N/A'}`);
  });
  
  // Hủy tất cả các gói pending_payment
  const pendingResult = await UserPackage.updateMany(
    { user_id: user._id, status: 'pending_payment' },
    { $set: { status: 'cancelled' } }
  );
  console.log(`\n✅ Đã hủy ${pendingResult.modifiedCount} gói pending_payment`);
  
  // Tìm gói active hợp lệ (chưa hết hạn)
  const validActive = await UserPackage.findOne({
    user_id: user._id,
    status: 'active',
    expired_at: { $gt: new Date() }
  }).sort({ createdAt: -1 }).populate('package_id');
  
  if (validActive) {
    console.log(`\n📦 Gói active hợp lệ: ${validActive.package_id?.name} (${validActive.package_id?.price}đ) - Hết hạn: ${validActive.expired_at?.toISOString()}`);
    
    // Đồng bộ lại package_id trên User model
    const pkgId = validActive.package_id?._id || validActive.package_id;
    await User.findByIdAndUpdate(user._id, { package_id: pkgId });
    console.log(`✅ Đã đồng bộ User.package_id = ${pkgId}`);
  } else {
    console.log(`\n⚠️ Không tìm thấy gói active hợp lệ nào. Reset về gói Miễn phí.`);
    const freePkg = await Package.findOne({ price: 0 });
    if (freePkg) {
      await UserPackage.create({
        user_id: user._id,
        package_id: freePkg._id,
        started_at: new Date(),
        expired_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'active',
        price_paid: 0
      });
      await User.findByIdAndUpdate(user._id, { package_id: freePkg._id });
      console.log(`✅ Đã gán gói Miễn phí cho user.`);
    }
  }
  
  await mongoose.disconnect();
  console.log('\n🎉 Hoàn tất!');
}

fix().catch(err => {
  console.error('Lỗi:', err);
  process.exit(1);
});
