const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.MONGO_DB_NAME || 'aura-shot'
        });
        console.log(`Đã kết nối MongoDB thành công: ${conn.connection.host}:${conn.connection.port || '27017'}`);
        console.log(`Tên Database đang kết nối: "${conn.connection.name}"`);
        
        // Đếm số lượng ảnh thực tế trong database mà backend nhìn thấy
        const db = conn.connection.db;
        const photosCollection = db.collection('photos');
        const count = await photosCollection.countDocuments({});
        console.log(`📊 [Hệ thống] Số lượng ảnh hiện có trong database backend: ${count} ảnh.`);
    } catch (error) {
        console.error(`Lỗi kết nối MongoDB: ${error.message}`);
        process.exit(1);
    }
}

module.exports = connectDB;
