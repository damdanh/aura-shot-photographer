// Kiểm tra dữ liệu photos trong album bàn giao
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const Photo = require('./src/models/Photo');

  // Album ID from the URL in the screenshot: 6a8c2934684d3cc76622a946
  // Thử cả album ID lấy từ URL screenshot
  const albumId = '6a8c2934684d3cc76622a946';
  
  let photos = await Photo.find({ album_id: albumId }).sort({ createdAt: -1 });
  
  if (photos.length === 0) {
    // Thử tìm album ID khác từ URL: 6a8c293468d3cc76622a946
    console.log('No photos found with that ID, searching for recent albums...');
    const Album = require('./src/models/Album');
    const recentAlbums = await Album.find({}).sort({ createdAt: -1 }).limit(5);
    for (const a of recentAlbums) {
      const count = await Photo.countDocuments({ album_id: a._id });
      console.log(`Album: ${a.name} | ID: ${a._id} | Photos: ${count}`);
    }
    
    if (recentAlbums.length > 0) {
      // Dùng album đầu tiên có ảnh
      for (const a of recentAlbums) {
        const count = await Photo.countDocuments({ album_id: a._id });
        if (count > 0) {
          photos = await Photo.find({ album_id: a._id }).sort({ createdAt: -1 });
          console.log(`\nUsing album: ${a.name} (${a._id}) with ${count} photos\n`);
          break;
        }
      }
    }
  }
  
  console.log(`\n=== Total photos found: ${photos.length} ===\n`);
  
  photos.forEach((p, i) => {
    console.log(`--- Photo #${i + 1} ---`);
    console.log('  _id:', p._id.toString());
    console.log('  file_name:', p.file_name || '(empty)');
    console.log('  thumbnail_url:', p.thumbnail_url || '(empty)');
    console.log('  image_url:', p.image_url || '(empty)');
    console.log('  drive_link:', p.drive_link || '(empty)');
    console.log('  drive_file_id:', p.drive_file_id || '(empty)');
    console.log('  storage_type:', p.storage_type || '(empty)');
    console.log('  createdAt:', p.createdAt);
    console.log('');
  });

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
