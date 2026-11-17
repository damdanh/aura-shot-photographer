const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const path = require('path');


// Router
const authRoutes = require('./routers/authRoutes');
const photoRoutes = require('./routers/photoRoutes');
const albumRoutes = require('./routers/albumRoutes');
const productRoutes = require('./routers/productRoutes');
const serviceRoutes = require('./routers/serviceRoutes');
const cartRoutes = require('./routers/cartRoutes');
const orderRoutes = require('./routers/orderRoutes');
const storeRoutes = require('./routers/storeRoutes');
const adminRoutes = require('./routers/admin/adminRoutes');
const packageRoutes = require('./routers/packageRoutes');
const statsRoutes = require('./routers/statsRoutes');
const clientRoutes = require('./routers/clientRoutes');
const reviewRoutes = require('./routers/reviewRoutes');
const notificationRouter = require('./routers/notificationRoutes');

// AI services
const { initFaceAPI } = require('./services/faceService');

const app = express();

connectDB();

// Tải trước các mô hình AI khi server bắt đầu khởi chạy
initFaceAPI().catch(err => console.error("❌ Lỗi nạp mô hình AI khi khởi động server:", err));

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes); 
app.use('/api/photo', photoRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/album', albumRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/admin/albums', albumRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product', productRoutes); 
app.use('/api/admin/products', productRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/admin/services', serviceRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/orders', orderRoutes);    
app.use('/', storeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/photographer/clients', clientRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/store', statsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRouter);
// Route mặc định
app.get('/', (req, res) => {
    res.send('Backend Aura Shot đã chạy thành công!');
});

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/uploads', express.static('/var/www/aura-shot/uploads'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../public')));

// Global error handler – always return JSON
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + err.message });
});
// Kích hoạt tác vụ quét ngầm gói SaaS hết hạn
require('./utils/cronJobs');
// Export app hoặc lắng nghe PORT tùy theo cấu hình khởi chạy của bạn
const PORT = process.env.PORT || 5001;

const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // FE url
    methods: ['GET', 'POST']
  }
});

app.locals.io = io;

io.on('connection', (socket) => {
  console.log('⚡ Mới có Client kết nối Socket.IO:', socket.id);
  
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`Client ${socket.id} đã join room: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(' Client đã ngắt kết nối:', socket.id);
  });
});

server.listen(PORT, () => {
    console.log(` Server Backend đang chạy tại cổng ${PORT}`);
});

