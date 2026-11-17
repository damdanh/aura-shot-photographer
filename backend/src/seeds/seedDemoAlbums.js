require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Album = require('../models/Album');
const Photo = require('../models/Photo');

const albumSpecs = [
  { name: 'Đám cưới bên biển', count: 8, seed: 'wedding-beach' },
  { name: 'Chân dung mùa thu', count: 9, seed: 'autumn-portrait' },
  { name: 'Du lịch Đà Lạt', count: 10, seed: 'dalat-travel' },
  { name: 'Gia đình hạnh phúc', count: 8, seed: 'happy-family' },
  { name: 'Thành phố về đêm', count: 10, seed: 'night-city' }
];

async function seed() {
  const email = String(process.argv[2] || 'doanthaibao@gmail.com').trim().toLowerCase();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'aura-shot-datn' });
  const user = await User.findOne({ email, role: 'photographer' });
  if (!user) throw new Error(`Không tìm thấy tài khoản nhiếp ảnh gia ${email}`);

  let totalPhotos = 0;
  for (let albumIndex = 0; albumIndex < albumSpecs.length; albumIndex += 1) {
    const spec = albumSpecs[albumIndex];
    const album = await Album.findOneAndUpdate(
      { user_id: user._id, name: spec.name },
      { $set: { drive_folder_id: `demo-${spec.seed}`, pin_code: String(2401 + albumIndex), status: 'active', is_safe: true, is_banned: false } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    await Photo.deleteMany({ album_id: album._id, drive_file_id: /^demo-/ });
    const photos = Array.from({ length: spec.count }, (_, index) => {
      const imageSeed = `${spec.seed}-${index + 1}`;
      return {
        album_id: album._id,
        file_name: `${spec.seed}-${String(index + 1).padStart(2, '0')}.jpg`,
        thumbnail_url: `https://picsum.photos/seed/${imageSeed}/1200/800`,
        drive_file_id: `demo-${imageSeed}`,
        drive_link: `https://picsum.photos/seed/${imageSeed}/1920/1280`,
        file_size: 450000 + index * 17321,
        is_safe: true,
        is_banned: false
      };
    });
    await Photo.insertMany(photos);
    totalPhotos += photos.length;
    console.log(`- ${spec.name}: ${photos.length} ảnh`);
  }

  console.log(`Đã tạo ${albumSpecs.length} album với tổng cộng ${totalPhotos} ảnh cho ${user.full_name}.`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Tạo album mẫu thất bại:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
