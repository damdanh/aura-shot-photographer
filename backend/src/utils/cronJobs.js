const cron = require('node-cron');
const UserPackage = require('../models/UserPackage');
const Order = require('../models/Order');
const sendEmail = require('./sendEmail');

// Lập lịch quét chạy tự động lúc 00:00 mỗi đêm (0 0 * * *)
cron.schedule('0 0 * * *', async () => {
  try {
    console.log(' [Cron Job] Bắt đầu quét kiểm tra các gói đăng ký SaaS đã hết hạn...');

    // Tìm các gói sắp hết hạn
    const expiredPackages = await UserPackage.find({
        status: 'active',
        expired_at: { $lt: new Date() }
    });

    if (expiredPackages.length > 0) {
        // Cập nhật trạng thái thành expired
        await UserPackage.updateMany(
            { _id: { $in: expiredPackages.map(p => p._id) } },
            { $set: { status: 'expired' } }
        );

        // Đổi package_id của user về gói miễn phí (giáng cấp)
        const Package = require('../models/Package');
        const User = require('../models/User');
        const freePackage = await Package.findOne({ price: 0 });
        
        if (freePackage) {
            const userIds = expiredPackages.map(p => p.user_id);
            await User.updateMany(
                { _id: { $in: userIds } },
                { $set: { package_id: freePackage._id } }
            );
        }
        
        console.log(`[Cron Job] Quét hoàn tất! Đã tự động hết hạn và giáng cấp cho ${expiredPackages.length} tài khoản.`);
    } else {
        console.log(`[Cron Job] Quét hoàn tất! Không có gói nào hết hạn.`);
    }
  } catch (error) {
    console.error('[Cron Job] Lỗi khi xử lý quét gói hết hạn:', error.message);
  }
});

// Lập lịch gửi email nhắc nhở lịch chụp lúc 07:00 sáng mỗi ngày (0 7 * * *)
cron.schedule('0 7 * * *', async () => {
  try {
    console.log(' [Cron Job] Bắt đầu quét đơn hàng để gửi email nhắc lịch chụp...');
    
    // Tính ngày mai (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    
    // Tìm các đơn hàng đã thanh toán hoặc đang xử lý và có lịch chụp vào ngày mai
    const orders = await Order.find({
      status: { $in: ['Paid', 'Processing'] },
      booking_date: tomorrowStr
    }).populate('photographer_id', 'email full_name')
      .populate('user_id', 'email full_name');
      
    if (orders.length === 0) {
      console.log(` [Cron Job] Không có lịch chụp nào vào ngày mai (${tomorrowStr}).`);
      return;
    }
    
    // Gửi email cho từng đơn hàng
    for (const order of orders) {
      const customerEmail = order.user_id ? order.user_id.email : null;
      const photographerEmail = order.photographer_id ? order.photographer_id.email : null;
      
      const subject = `[Aura Shot] Nhắc nhở lịch chụp ảnh vào ngày mai (${tomorrowStr})`;
      const text = `Xin chào,\n\nĐây là email nhắc nhở tự động từ Aura Shot về lịch chụp ảnh của bạn vào ngày mai (${tomorrowStr}).\n\n📌 Thông tin Đơn hàng:\n- Mã đơn hàng: #${order.orderCode}\n- Khách hàng: ${order.customer_name}\n- Số điện thoại: ${order.phone}\n\nVui lòng chuẩn bị và có mặt đúng giờ nhé!\n\nTrân trọng,\nĐội ngũ Aura Shot.`;
      
      // Gửi cho khách hàng
      if (customerEmail) {
        await sendEmail({ email: customerEmail, subject, text }).catch(e => console.log('Lỗi gửi mail KH:', e.message));
      }
      
      // Gửi cho thợ ảnh
      if (photographerEmail) {
        await sendEmail({ email: photographerEmail, subject, text }).catch(e => console.log('Lỗi gửi mail Thợ:', e.message));
      }
    }
    
    console.log(` [Cron Job] Đã gửi thành công email nhắc lịch cho ${orders.length} đơn hàng!`);
  } catch (error) {
    console.error('[Cron Job] Lỗi khi gửi email nhắc lịch:', error.message);
  }
});

// Lập lịch tự động hủy đơn hàng Pending quá 24h (0 * * * * - mỗi giờ)
cron.schedule('0 * * * *', async () => {
  try {
    console.log(' [Cron Job] Bắt đầu quét các đơn hàng Pending quá 24h...');
    const Product = require('../models/Product');
    const OrderItem = require('../models/OrderItem');
    const Notification = require('../models/Notification');
    
    // Tìm các đơn hàng tạo cách đây hơn 24h
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredOrders = await Order.find({
        status: 'Pending',
        createdAt: { $lt: cutoffTime }
    });

    if (expiredOrders.length === 0) {
        console.log(` [Cron Job] Không có đơn hàng Pending nào quá hạn.`);
        return;
    }

    console.log(` [Cron Job] Tìm thấy ${expiredOrders.length} đơn hàng quá hạn thanh toán. Đang xử lý...`);

    for (const order of expiredOrders) {
        order.status = 'Cancelled';
        order.cancelled_reason = 'Hệ thống tự động hủy do quá hạn thanh toán (24h)';
        await order.save();

        // Hoàn lại tồn kho
        const orderItems = await OrderItem.find({ order_id: order._id });
        for (const item of orderItems) {
            if (item.item_type === 'product' && item.product_id) {
                const prod = await Product.findById(item.product_id);
                if (prod && prod.is_physical) {
                    await Product.findByIdAndUpdate(item.product_id, {
                        $inc: { stock: item.quantity }
                    });
                }
            }
        }

        // Gửi thông báo cho thợ ảnh
        if (order.photographer_id) {
            await Notification.create({
                user_id: order.photographer_id,
                type: 'cancelled_order',
                order_id: order._id,
                target_url: `/photographer/orders`,
                title: "Đơn hàng tự động hủy",
                message: `Đơn hàng #${order.orderCode} đã bị hệ thống tự động hủy do khách hàng không thanh toán sau 24h. Tồn kho đã được hoàn lại.`
            });
        }
    }
    console.log(` [Cron Job] Hoàn tất hủy tự động ${expiredOrders.length} đơn hàng!`);
  } catch (error) {
    console.error('[Cron Job] Lỗi khi quét hủy đơn hàng:', error.message);
  }
});

// Lập lịch tự động xóa Album quá hạn lúc 2:00 sáng mỗi ngày (0 2 * * *)
cron.schedule('0 2 * * *', async () => {
  try {
    console.log(' [Cron Job] Bắt đầu tiến trình xóa Album quá hạn...');
    const Album = require('../models/Album');
    const Photo = require('../models/Photo');
    const CustomerAlbumAccess = require('../models/CustomerAlbumAccess');
    const User = require('../models/User');
    const googleDriveService = require('../services/googleDriveService');
    const awsRekognitionService = require('../services/awsRekognitionService');
    const awsS3Service = require('../services/awsS3Service');
    const vpsStorageService = require('../services/vpsStorageService');

    const expiredAlbums = await Album.find({
        expires_at: { $lte: new Date() },
        status: { $ne: 'deleted' }
    });

    if (expiredAlbums.length === 0) {
        console.log('✅ [Cron Job] Không có Album nào quá hạn cần xóa.');
        return;
    }

    console.log(`🗑️ [Cron Job] Tìm thấy ${expiredAlbums.length} Album quá hạn. Bắt đầu xóa...`);

    for (const album of expiredAlbums) {
        try {
            // Tính toán tổng dung lượng file_size để hoàn trả lại storage
            let bytesToSubtract = 0;
            const albumPhotos = await Photo.find({ album_id: album._id });

            if (album.storage_owner === 'system') {
                bytesToSubtract = albumPhotos.reduce((sum, photo) => sum + (photo.file_size || 0), 0);
            }

            // 1. Xóa ảnh thật trên VPS
            for (const photo of albumPhotos) {
                if (photo.drive_file_id && !photo.drive_file_id.startsWith('mock_')) {
                    try {
                        if (typeof vpsStorageService.deletePhotoFromVPS === 'function') {
                            await vpsStorageService.deletePhotoFromVPS(photo.drive_file_id);
                        }
                    } catch (vpsErr) {
                        console.error(` Lỗi khi xóa VPS cho ảnh ${photo.drive_file_id}:`, vpsErr.message);
                    }
                }
            }

            // 2. Xóa ảnh/thumbnail trên AWS S3
            try {
                const s3Prefix = `albums/${album._id}/`;
                const s3Objects = await awsS3Service.listObjects(s3Prefix);
                for (const obj of s3Objects) {
                    await awsS3Service.deleteFromS3(obj.Key);
                }
            } catch (s3Err) {
                console.error(` Lỗi khi dọn S3 cho album ${album._id}:`, s3Err.message);
            }

            // 3. Xóa folder trên Google Drive (nếu thợ ảnh kết nối Drive riêng)
            if (album.drive_folder_id && !album.drive_folder_id.startsWith('mock_drive_')) {
                try {
                    const photographer = await User.findById(album.user_id);
                    const customRefreshToken = photographer?.googleDrive?.isConnected ? photographer.googleDrive.refreshToken : null;
                    if (typeof googleDriveService.deleteFromDrive === 'function') {
                        await googleDriveService.deleteFromDrive(album.drive_folder_id, customRefreshToken);
                    }
                } catch (driveErr) {
                    console.error(` Lỗi khi xóa Google Drive folder cho Album ${album._id}:`, driveErr.message);
                }
            }

            // 4. Xóa Collection trên AWS Rekognition
            try {
                const collectionId = `album_${album._id.toString()}`;
                if (typeof awsRekognitionService.deleteAlbumCollection === 'function') {
                    await awsRekognitionService.deleteAlbumCollection(collectionId);
                }
            } catch (awsErr) {
                console.error(` Lỗi khi xóa AWS Rekognition Collection cho Album ${album._id}:`, awsErr.message);
            }

            // 5. Hoàn trả lại dung lượng lưu trữ cho thợ ảnh
            if (bytesToSubtract > 0) {
                await User.findByIdAndUpdate(album.user_id, {
                    $inc: { used_storage_bytes: -bytesToSubtract }
                });
                // Đảm bảo không bị số âm
                await User.updateOne(
                    { _id: album.user_id, used_storage_bytes: { $lt: 0 } },
                    { $set: { used_storage_bytes: 0 } }
                );
            }

            // 6. Xóa dữ liệu trong Database
            await Photo.deleteMany({ album_id: album._id });
            await CustomerAlbumAccess.deleteMany({ album_id: album._id });
            await Album.findByIdAndDelete(album._id);

            console.log(`✅ [Cron Job] Đã xóa hoàn toàn Album: ${album.name} (ID: ${album._id})`);
        } catch (err) {
            console.error(`❌ [Cron Job] Lỗi khi xóa Album ${album._id}:`, err.message);
        }
    }
    console.log('🏁 [Cron Job] Tiến trình xóa Album quá hạn hoàn tất!');
  } catch (error) {
    console.error('❌ [Cron Job] Lỗi hệ thống khi xóa Album quá hạn:', error.message);
  }
});

