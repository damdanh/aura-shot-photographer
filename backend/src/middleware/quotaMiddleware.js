const User = require('../models/User');
const UserPackage = require('../models/UserPackage');

exports.checkStorageQuota = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // 1. Tìm thông tin gói cước đang hoạt động và chưa hết hạn của User
        const activeUserPackage = await UserPackage.findOne({ 
            user_id: userId, 
            status: 'active',
            expired_at: { $gt: new Date() }
        }).populate('package_id');
        
        if (!activeUserPackage) {
            return res.status(403).json({ success: false, message: "Bạn chưa đăng ký gói dịch vụ hoặc gói dịch vụ đã hết hạn!" });
        }

        const packageInfo = activeUserPackage.package_id;

        // 2. Nếu Photographer dùng gói Premium/Pro (Đã kết nối Drive cá nhân), bỏ qua kiểm tra dung lượng của hệ thống
        const photographer = await User.findById(userId);
        if (photographer && photographer.googleDrive && photographer.googleDrive.isConnected) {
            req.storageOwner = 'photographer';
            return next();
        }

        req.storageOwner = 'system';

        // 3. Nếu dùng bộ nhớ hệ thống (Gói Free/Basic), kiểm tra dung lượng còn lại
        const currentUsedBytes = photographer.used_storage_bytes || 0;
        
        // Nếu packageInfo.storage_gb là -1, nghĩa là không giới hạn dung lượng hệ thống
        if (packageInfo.storage_gb === -1) {
            return next();
        }
        
        const maxStorageBytes = packageInfo.storage_gb * 1024 * 1024 * 1024; // Đổi GB sang Bytes

        // Ước tính dung lượng files chuẩn bị upload lên từ client
        // Nếu upload qua multer/multipart: req.files hoặc req.file
        let incomingBytes = 0;
        if (req.files && Array.isArray(req.files)) {
            req.files.forEach(f => { incomingBytes += f.size; });
        } else if (req.files && req.files.photos && Array.isArray(req.files.photos)) {
            req.files.photos.forEach(f => { incomingBytes += f.size; });
        } else if (req.file) {
            incomingBytes += req.file.size;
        }

        // 4. Nếu tổng dung lượng sau khi upload vượt 80% hạn mức gói, kích hoạt gửi email cảnh báo ngầm
        if (maxStorageBytes > 0 && (currentUsedBytes + incomingBytes) / maxStorageBytes >= 0.8) {
            const emailService = require('../services/emailService');
            const usedGb = (currentUsedBytes + incomingBytes) / (1024 * 1024 * 1024);
            const maxGb = packageInfo.storage_gb;
            setImmediate(async () => {
                try {
                    await emailService.sendQuotaWarning(photographer.email, photographer.full_name, usedGb, maxGb);
                } catch (emailErr) {
                    console.error("Lỗi gửi email cảnh báo vượt hạn mức 80%:", emailErr.message);
                }
            });
        }

        if (currentUsedBytes + incomingBytes > maxStorageBytes) {
            // Dọn dẹp các file đã được multer tải tạm lên disk để tránh rác server
            const fs = require('fs');
            const filesToDelete = [];
            if (req.files) {
                if (Array.isArray(req.files)) {
                    filesToDelete.push(...req.files);
                } else if (req.files.photos && Array.isArray(req.files.photos)) {
                    filesToDelete.push(...req.files.photos);
                }
            } else if (req.file) {
                filesToDelete.push(req.file);
            }
            
            filesToDelete.forEach(f => {
                if (f.path && fs.existsSync(f.path)) {
                    try { fs.unlinkSync(f.path); } catch (err) {}
                }
            });

            return res.status(400).json({ 
                success: false, 
                message: `Dung lượng lưu trữ của bạn đã vượt quá giới hạn gói (${packageInfo.storage_gb} GB). Vui lòng nâng cấp gói cước!` 
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi kiểm tra dung lượng lưu trữ: " + error.message });
    }
};
