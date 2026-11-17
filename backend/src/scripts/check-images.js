require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Album = require('../models/Album');

async function check() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'aura-shot-datn' });
  
  const user = await User.findOne({ email: 'lecuong@gmail.com' });
  console.log('User:', user ? { email: user.email, full_name: user.full_name, avatar_url: user.avatar_url } : 'Not found');
  
  const albums = await Album.find({}).limit(10);
  console.log('\nAlbums:');
  albums.forEach(a => {
    console.log(`- ${a.name} (is_public: ${a.is_public}): cover_image_url = "${a.cover_image_url}"`);
  });
  
  await mongoose.disconnect();
}

check().catch(console.error);
