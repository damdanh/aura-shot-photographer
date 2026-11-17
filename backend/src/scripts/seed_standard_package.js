require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Package = require('../models/Package');

const run = async () => {
    await connectDB();
    console.log("Đang thêm gói Tiêu chuẩn vào CSDL...");
    const standardPackage = { 
        name: 'Tiêu chuẩn', 
        max_albums: 20, 
        max_products: 15, 
        price: 49000, 
        duration_days: 30, 
        storage_gb: 30, 
        max_photos: 1000, 
        features: ['30 GB dung lượng', 'Tối đa 20 album', '1.000 ảnh', 'Chia sẻ album', 'Hỗ trợ qua email'] 
    };

    const exists = await Package.findOne({ name: 'Tiêu chuẩn' });
    if (!exists) {
        await Package.create(standardPackage);
        console.log("Đã thêm thành công!");
    } else {
        console.log("Gói Tiêu chuẩn đã tồn tại trong CSDL.");
    }
    process.exit(0);
};

run();
