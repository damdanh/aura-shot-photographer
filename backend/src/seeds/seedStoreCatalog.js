require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/Service');

const products = [
  { name: 'Album ảnh cưới cao cấp', type: 'product:album', price: 850000, is_physical: true, image: 'wedding-album.png' },
  { name: 'Khung ảnh gỗ để bàn', type: 'product:frame', price: 320000, is_physical: true, image: 'wood-frame.png' },
  { name: 'Bộ ảnh kỹ thuật số 30 tấm', type: 'product:digital', price: 490000, is_physical: false, image: 'digital-gallery.png' },
  { name: 'Ảnh ép gỗ treo tường', type: 'product:wall-art', price: 650000, is_physical: true, image: 'wood-wall-art.png' },
  { name: 'Photobook kỷ niệm', type: 'product:photobook', price: 990000, is_physical: true, image: 'memory-photobook.png' }
];

const services = [
  { name: 'Chụp ảnh chân dung cá nhân', description: 'Buổi chụp 2 giờ, hỗ trợ tạo dáng và chỉnh sửa 20 ảnh.', type: 'shooting', duration: '2 giờ', price: 1200000, image: 'portrait-session.png' },
  { name: 'Chụp ảnh cưới ngoại cảnh', description: 'Gói chụp ngoại cảnh trong ngày, bao gồm trang điểm và 40 ảnh chỉnh sửa.', type: 'shooting', duration: '1 ngày', price: 6500000, image: 'outdoor-wedding.png' },
  { name: 'Chụp ảnh gia đình', description: 'Buổi chụp dành cho gia đình tối đa 6 người, bàn giao 25 ảnh.', type: 'shooting', duration: '3 giờ', price: 2200000, image: 'family-session.png' },
  { name: 'Chụp sự kiện doanh nghiệp', description: 'Ghi lại toàn bộ hoạt động sự kiện và bàn giao ảnh chất lượng cao.', type: 'shooting', duration: '4 giờ', price: 3500000, image: 'corporate-event.png' },
  { name: 'Chỉnh sửa ảnh chuyên nghiệp', description: 'Cân màu, làm sạch chi tiết và chỉnh da tự nhiên cho 20 ảnh.', type: 'editing', duration: '2 ngày', price: 800000, image: 'photo-editing.png' }
];

async function seed() {
  const email = String(process.argv[2] || 'doanthaibao@gmail.com').trim().toLowerCase();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'aura-shot-datn' });
  const user = await User.findOne({ email, role: 'photographer' });
  if (!user) throw new Error(`Không tìm thấy nhiếp ảnh gia ${email}`);

  for (const [index, item] of products.entries()) {
    const { image, ...data } = item;
    await Product.findOneAndUpdate(
      { user_id: user._id, name: data.name },
      { $set: { ...data, user_id: user._id, image_url: `http://localhost:5001/uploads/catalog/${image}`, is_active: true, is_featured: index < 2, is_banned: false, status: 'active', is_safe: true, isDeleted: false } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  for (const [index, item] of services.entries()) {
    const { image, ...data } = item;
    await Service.findOneAndUpdate(
      { user_id: user._id, name: data.name },
      { $set: { ...data, user_id: user._id, image_url: `http://localhost:5001/uploads/catalog/${image}`, is_active: true, is_featured: index < 2, is_banned: false, status: 'active', is_safe: true, isDeleted: false } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  const [productCount, serviceCount] = await Promise.all([
    Product.countDocuments({ user_id: user._id, name: { $in: products.map((item) => item.name) } }),
    Service.countDocuments({ user_id: user._id, name: { $in: services.map((item) => item.name) } })
  ]);
  console.log(`Đã lưu ${productCount} sản phẩm và ${serviceCount} dịch vụ cho ${user.full_name}.`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Tạo danh mục thất bại:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
