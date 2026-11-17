require('dotenv').config();
const mongoose = require('mongoose');
const Package = require('../models/Package');

const packages = [
  {
    name: 'Miễn phí', price: 0, duration_days: 0, storage_gb: 2,
    max_albums: 2, max_products: 3, max_photos: 500, is_active: true,
    features: [
      '2 GB dung lượng hệ thống',
      'Tối đa 3 Sản phẩm / Dịch vụ đăng bán',
      'Tối đa 2 Album hoạt động cùng lúc',
      'Tối đa 500 ảnh tải lên',
      'Hỗ trợ tìm kiếm khuôn mặt bằng AI',
      'Không hỗ trợ kết nối Google Drive cá nhân'
    ]
  },
  {
    name: 'Tiêu chuẩn', price: 49000, duration_days: 30, storage_gb: 30,
    max_albums: 20, max_products: 15, max_photos: 1000, is_active: true,
    features: [
      '30 GB dung lượng',
      'Tối đa 15 Sản phẩm / Dịch vụ đăng bán',
      'Tối đa 20 album',
      '1.000 ảnh',
      'Chia sẻ album',
      'Hỗ trợ qua email'
    ]
  },
  {
    name: 'Chuyên nghiệp', price: 149000, duration_days: 30, storage_gb: 50,
    max_albums: 30, max_products: 30, max_photos: 10000, is_active: true,
    features: [
      '50 GB dung lượng hệ thống',
      'Tối đa 30 Sản phẩm / Dịch vụ đăng bán',
      'Tối đa 30 Album hoạt động cùng lúc',
      'Tối đa 10.000 ảnh tải lên',
      'Hỗ trợ tìm kiếm khuôn mặt bằng AI',
      'Hỗ trợ kết nối Google Drive cá nhân (Thử nghiệm 5 Album)'
    ]
  },
  {
    name: 'Cao cấp', price: 349000, duration_days: 30, storage_gb: -1,
    max_albums: -1, max_products: -1, max_photos: -1, is_active: true,
    features: [
      'Không giới hạn dung lượng lưu trữ',
      'Không giới hạn số lượng Sản phẩm / Dịch vụ',
      'Không giới hạn số lượng Album & Ảnh',
      'Kết nối Google Drive cá nhân không giới hạn',
      'Hỗ trợ tìm kiếm khuôn mặt bằng AI',
      'Hỗ trợ ưu tiên 24/7 (Có đội ngũ kỹ thuật hỗ trợ riêng)'
    ]
  }
];

async function seed() {
  if (!process.env.MONGO_URI) throw new Error('Chưa cấu hình MONGO_URI trong backend/.env');
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME || 'aura-shot'
  });
  for (const item of packages) {
    await Package.findOneAndUpdate({ name: item.name }, { $set: item }, { upsert: true, returnDocument: 'after', runValidators: true });
  }
  const saved = await Package.find({ name: { $in: packages.map((item) => item.name) } }).sort({ price: 1 }).lean();
  console.log(`Đã lưu ${saved.length} gói vào MongoDB (${mongoose.connection.name}):`);
  saved.forEach((item) => console.log(`- ${item.name}: ${item.price.toLocaleString('vi-VN')} VND`));
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Đổ dữ liệu gói thất bại:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
