const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'aura-shot' });
    const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword || adminPassword.length < 16) {
  throw new Error(
    'ADMIN_PASSWORD chưa được cấu hình hoặc chưa đủ 16 ký tự'
  );
}

const hash = await bcrypt.hash(adminPassword, 10);
    const admin = await User.findOneAndUpdate(
      { email: 'admin@aurashot.vn' },
      {
        $set: {
          full_name: 'Quản trị viên Hệ thống',
          email: 'admin@aurashot.vn',
          password: hash,
          role: 'admin',
          is_active: true,
          is_banned: false,
          isDeleted: false
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('✅ ĐÃ TẠO THÀNH CÔNG TÀI KHOẢN ADMIN:');
    console.log(`- Email: ${admin.email}`);
    console.log(`- Role: ${admin.role}`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Lỗi tạo tài khoản admin:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAdmin();
d