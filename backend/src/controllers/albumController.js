const mongoose = require('mongoose');

const UserPackage = require('../models/UserPackage');
const Album = require('../models/Album');
const User = require('../models/User');
const Photo = require('../models/Photo');
const awsRekognitionService = require('../services/awsRekognitionService');
const awsS3Service = require('../services/awsS3Service');
const CustomerAlbumAccess = require('../models/CustomerAlbumAccess');
const googleDriveService = require('../services/googleDriveService');
const PhotographerProfile = require('../models/PhotographerProfile');
const moderationService = require('../services/moderationService');

// POST /api/album/create hoặc /api/album/
exports.createAlbum = async (req, res) => {
    try {
        const { name, pin_code, customer_email, customer_name, customer_phone, allow_free_download, auto_delete_album_days } = req.body; 
        const user_id = req.user.id;

        // 1. Kiểm tra tính hợp lệ của dữ liệu đầu vào
        if (!name || !pin_code) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Tên Album và Mã PIN!" });
        }

        // 2. Kiểm duyệt tên album bằng AI Badwords
        const textMod = moderationService.checkText(name);
        let isSafe = true;
        let isBanned = false;
        let statusVal = 'active';
        let aiNote = null;
        let suffixMsg = "";

        if (textMod.isViolated) {
            isSafe = false;
            isBanned = true;
            statusVal = 'banned';
            aiNote = `Tên album chứa từ ngữ nhạy cảm vi phạm quy chuẩn: "${textMod.matchedWord}"`;
            suffixMsg = " (Album bị tự động khóa do tên chứa từ ngữ nhạy cảm!)";
        }

        // 3. Kiểm tra xem thợ ảnh đã có gian hàng chưa
        const profile = await PhotographerProfile.findOne({ user_id });
        if (!profile) {
            return res.status(403).json({
                success: false,
                message: "Yêu cầu tạo gian hàng trước!"
            });
        }

        // 3.5. Kiểm tra giới hạn max_albums từ gói SaaS
        const UserPackage = require('../models/UserPackage');
        const activeSub = await UserPackage.findOne({
            user_id,
            status: 'active',
            expired_at: { $gt: new Date() }
        }).populate('package_id');

        if (!activeSub || !activeSub.package_id) {
            return res.status(403).json({
                success: false,
                message: "Bạn chưa đăng ký gói dịch vụ nào hoặc gói đã hết hạn! Vui lòng mua gói SaaS để tiếp tục tạo Album."
            });
        }

        const maxAlbums = activeSub.package_id.max_albums;
        if (maxAlbums !== -1) {
            const currentAlbumCount = await Album.countDocuments({ user_id });
            if (currentAlbumCount >= maxAlbums) {
                return res.status(403).json({
                    success: false,
                    message: `Gói dịch vụ hiện tại của bạn chỉ cho phép tạo tối đa ${maxAlbums} Album. Vui lòng nâng cấp gói để tiếp tục!`
                });
            }
        }

        const photographer = await User.findById(user_id);
        const isConnected = photographer?.googleDrive?.isConnected || false;
        const customRefreshToken = isConnected ? photographer.googleDrive.refreshToken : null;
        const parentFolderId = isConnected ? photographer.googleDrive.rootFolderId : null;
        const storageOwner = isConnected ? 'photographer' : 'system';

        const albumId = new mongoose.Types.ObjectId();
        // 6. Gọi Google Drive API tạo thư mục thật lưu ảnh gốc cho Album (Multi-tenant OAuth2 support)
        let driveFolderId = `mock_drive_${albumId.toString()}`;
        try {
            driveFolderId = await googleDriveService.createAlbumFolder(name, parentFolderId, customRefreshToken);
        } catch (driveErr) {
            console.error(" Không tạo được thư mục trên Drive, sử dụng ID tạm thời:", driveErr.message);
        }

        // Tính toán expires_at nếu có auto_delete_album_days
        let expiresAt = null;
        if (auto_delete_album_days) {
            const days = Number(auto_delete_album_days);
            if (!isNaN(days) && days > 0) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + days);
            }
        }

        // 7. Tạo Album trong MongoDB với ID Drive thật và metadata kiểm duyệt
        const newAlbum = await Album.create({
            _id: albumId,
            user_id,
            drive_folder_id: driveFolderId,
            name,
            pin_code: pin_code.toString(),
            is_safe: isSafe,
            is_banned: isBanned,
            status: statusVal,
            ai_moderation_note: aiNote,
            storage_owner: storageOwner,
            allow_free_download: allow_free_download !== undefined ? allow_free_download : true,
            expires_at: expiresAt
        });

        // 8. TỰ ĐỘNG TẠO FACE COLLECTION TRÊN AWS REKOGNITION
        const collectionId = `album_${newAlbum._id.toString()}`;
        await awsRekognitionService.createAlbumCollection(collectionId);

        // 8.5. TỰ ĐỘNG CẤP QUYỀN TRUY CẬP CHO KHÁCH HÀNG NẾU CÓ EMAIL
        if (customer_email) {
            await CustomerAlbumAccess.create({
                album_id: newAlbum._id,
                customer_email: customer_email.toLowerCase().trim(),
                customer_name: customer_name || "Khách hàng",
                customer_phone: customer_phone || ""
            });
        }

        // Sinh link QR Code tự động trỏ tới Album ở Frontend
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const albumUrl = `${clientUrl}/album/${newAlbum._id.toString()}?pin=${newAlbum.pin_code}`;
        const qrCodeUrl = `https://quickchart.io/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(albumUrl)}`

        res.status(201).json({
            success: true,
            message: `Tạo Album thành công!${suffixMsg}`,
            data: {
                ...newAlbum.toObject(),
                qr_code_url: qrCodeUrl
            }
        });

    } catch (error) {
        console.error("Lỗi luồng Tạo Album:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống tạo album: " + error.message });
    }
};

// GET /api/album/my-list
exports.getMyAlbums = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.query.user_id;
        if (!userId) {
            return res.status(400).json({ success: false, message: "Thiếu user_id!" });
        }
        const albums = await Album.find({ user_id: userId }).sort({ createdAt: -1 });
        
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        
        const albumsWithQr = await Promise.all(albums.map(async (album) => {
            const albumUrl = `${clientUrl}/album/${album._id.toString()}?pin=${album.pin_code}`;
            const qrCodeUrl = `https://quickchart.io/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(albumUrl)}`;
            
            const access = await CustomerAlbumAccess.findOne({ album_id: album._id });
            
            return {
                ...album.toObject(),
                qr_code_url: qrCodeUrl,
                customer: access ? {
                    customer_email: access.customer_email,
                    customer_name: access.customer_name,
                    customer_phone: access.customer_phone
                } : null
            };
        }));
        res.status(200).json({success: true, count: albumsWithQr.length, data: albumsWithQr})
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy danh sách album: " + error.message });
    }
};

// POST /api/album/verify-pin
exports.verifyAlbumPin = async (req, res) => {
    try {
        const album_id = req.body.album_id;
        const pin_code = req.body.pin_code || req.body.pin;

        if (!album_id || !pin_code) {
            return res.status(400).json({ success: false, message: "Thiếu album_id hoặc pin_code!" });
        }

        // Tìm Album trong Database
        const album = await Album.findById(album_id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album này trên hệ thống!" });
        }
        // So sánh mã PIN người dùng nhập với mã PIN lưu trong DB
        if (album.pin_code !== pin_code.toString()) {
            return res.status(401).json({ success: false, message: "Mã PIN bảo mật không chính xác. Vui lòng thử lại!" });
        }

        // Nếu đúng mã PIN, cho phép vượt qua cửa bảo mật
        // Nếu khách hàng đã đăng nhập, tự động cấp quyền truy cập để album này xuất hiện trong client-list sau này
        if (req.user) {
            const User = require('../models/User');
            const user = await User.findById(req.user.id);
            if (user) {
                const customer_email = user.email.toLowerCase().trim();
                let access = await CustomerAlbumAccess.findOne({ album_id, customer_email });
                if (!access) {
                    await CustomerAlbumAccess.create({
                        album_id,
                        customer_email,
                        customer_name: user.full_name || "Khách hàng",
                        customer_phone: user.phone || ""
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "🔓 Xác thực thành công! Quyền truy cập Album đã được mở.",
            album_name: album.name
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống xác thực: " + error.message });
    }
};

// DELETE /api/album/:album_id
exports.deleteAlbum = async (req, res) => {
    try {
        const { album_id } = req.params; 

        if (!album_id) {
            return res.status(400).json({ success: false, message: "Thiếu album_id để xóa!" });
        }

        const album = await Album.findById(album_id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album cần xóa trên hệ thống!" });
        }

        if (album.user_id.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: "Bạn không có quyền thực hiện hành động này!" });
        }

        console.log(`🧹 [Delete Service] Bắt đầu xóa Album: ${album.name}...`);

        // Tính toán dung lượng cần trừ đi khỏi used_storage_bytes của photographer
        let bytesToSubtract = 0;
        if (album.storage_owner === 'system') {
            const albumPhotos = await Photo.find({ album_id }, 'file_size');
            bytesToSubtract = albumPhotos.reduce((sum, photo) => sum + (photo.file_size || 0), 0);
        }

        // 1. XÓA FACE COLLECTION TRÊN AWS REKOGNITION
        const collectionId = `album_${album._id.toString()}`;
        try {
            await awsRekognitionService.deleteAlbumCollection(collectionId);
        } catch (awsError) {
            console.error(` Lỗi khi xóa Collection AWS cho album ${album_id}:`, awsError.message);
        }

        // 2. XÓA ẢNH TRÊN AWS S3
        try {
            const s3Prefix = `albums/${album_id}/`;
            const s3Objects = await awsS3Service.listObjects(s3Prefix);
            for (const obj of s3Objects) {
                await awsS3Service.deleteFromS3(obj.Key);
            }
            console.log(`[Delete Service] Đã dọn sạch ảnh trên S3 cho album ${album_id}.`);
        } catch (s3Error) {
            console.error(` Lỗi khi dọn ảnh trên S3 cho album ${album_id}:`, s3Error.message);
        }

        // 3. Xóa tất cả các bản ghi ảnh (Photo) gắn với mã album_id này trong MongoDB
        const deletePhotosResult = await Photo.deleteMany({ album_id });
        console.log(` [Delete Service] Đã xóa ${deletePhotosResult.deletedCount} ảnh trong MongoDB.`);

        // 4. Xóa tất cả các bản ghi phân quyền truy cập của album này
        await CustomerAlbumAccess.deleteMany({ album_id });
        console.log(` [Delete Service] Đã dọn dẹp các bản ghi phân quyền truy cập liên quan.`);

        // 5. Xóa nốt bản ghi Album gốc
        await Album.findByIdAndDelete(album_id);

        // Trực tiếp trừ đi dung lượng ảnh đã dùng của Photographer
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

        res.status(200).json({
            success: true,
            message: ` Đã xóa hoàn toàn Album "${album.name}", dọn sạch S3, AWS Collection và MongoDB thành công!`
        });

    } catch (error) {
        console.error(" Lỗi luồng Xóa Album:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi xóa album: " + error.message });
    }
};

// Hàm trích xuất folder ID từ URL Google Drive
function extractFolderId(url) {
    if (!url) return null;
    const folderReg1 = /\/folders\/([a-zA-Z0-9-_]+)/;
    const folderReg2 = /[?&]id=([a-zA-Z0-9-_]+)/;
    
    const match1 = url.match(folderReg1);
    if (match1) return match1[1];
    
    const match2 = url.match(folderReg2);
    if (match2) return match2[1];
    
    if (!url.includes('/') && url.length > 15) {
        return url;
    }
    return null;
}

// GET /api/album (Phân trang và truy vấn)
exports.getMyAlbumsWithQuery = async (req, res) => {
    try {
        const user_id = req.user.id;
        const filter = { user_id };
        
        const albums = await Album.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: albums.length, data: albums });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// POST /api/album/:id/sync-drive (Đồng bộ từ Google Drive vào DB của thợ chụp)
exports.syncGoogleDrive = async (req, res) => {
    try {
        const { id } = req.params;
        const { drive_folder_url } = req.body || {};

        const album = await Album.findById(id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album yêu cầu đồng bộ!" });
        }

        // Kiểm tra quyền sở hữu Album
        if (album.user_id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Bạn không có quyền thực hiện hành động này!" });
        }

        let folderId = album.drive_folder_id;
        if (drive_folder_url) {
            folderId = extractFolderId(drive_folder_url);
            if (!folderId) {
                return res.status(400).json({ success: false, message: "Định dạng link thư mục Google Drive không hợp lệ!" });
            }
        }

        if (!folderId) {
            return res.status(400).json({ success: false, message: "Album này chưa được liên kết với thư mục Google Drive!" });
        }

        // Truy vấn credentials thợ chụp để kết nối Drive
        const photographer = await User.findById(album.user_id);
        const customRefreshToken = photographer?.googleDrive?.isConnected ? photographer.googleDrive.refreshToken : null;

        console.log(`⏳ [Sync Service] Đang quét tệp tin từ thư mục Drive: ${folderId}...`);
        const driveFiles = await googleDriveService.listFiles(folderId, customRefreshToken);

        let insertedCount = 0;
        let deletedCount = 0;

        // Lấy danh sách ID hoặc tên file hiện có trên Drive để đối chiếu
        const driveFileNames = driveFiles.map(f => f.name);
        const driveFileIds = driveFiles.map(f => f.id);

        // 1. Quét ảnh trong DB, xóa những ảnh không còn tồn tại trên Google Drive
        const existingPhotos = await Photo.find({ album_id: album._id });
        for (let photo of existingPhotos) {
            const stillOnDrive = driveFiles.some(f => 
                f.name === photo.file_name || 
                f.webViewLink === photo.thumbnail_url || 
                photo.thumbnail_url.includes(f.id) ||
                (photo.drive_file_id && f.id === photo.drive_file_id)
            );

            if (!stillOnDrive) {
                // Xóa ảnh trên S3 nếu có
                if (photo.thumbnail_url && !photo.thumbnail_url.startsWith('http')) {
                    try {
                        await awsS3Service.deleteFromS3(photo.thumbnail_url);
                    } catch (s3Err) {
                        console.error("Lỗi dọn S3 khi sync drive:", s3Err.message);
                    }
                }
                await Photo.findByIdAndDelete(photo._id);
                deletedCount++;
            }
        }

        // 2. Nạp thêm ảnh mới từ Google Drive chưa có trong DB
        for (let file of driveFiles) {
            const photoExists = await Photo.findOne({ 
                album_id: album._id, 
                $or: [
                    { file_name: file.name },
                    { thumbnail_url: file.webViewLink },
                    { thumbnail_url: new RegExp(file.id) }
                ]
            });
            
            if (!photoExists) {
                const thumbnailUrl = `https://drive.google.com/uc?id=${file.id}`;
                
                // Kiểm duyệt ảnh bằng AI dựa vào tên file khi đồng bộ
                const imgMod = await moderationService.checkImage(null, file.name);
                let isSafe = true;
                let isBanned = false;
                let aiNote = null;

                if (imgMod.isViolated) {
                    isSafe = false;
                    isBanned = true;
                    aiNote = imgMod.reason;
                }

                await Photo.create({
                    album_id: album._id,
                    thumbnail_url: thumbnailUrl, // Sử dụng direct link thay vì webViewLink (HTML)
                    file_name: file.name,
                    drive_file_id: file.id,
                    drive_link: file.webViewLink,
                    is_safe: isSafe,
                    is_banned: isBanned,
                    ai_moderation_note: aiNote,
                    face: []
                });
                insertedCount++;
            }
        }

        res.status(200).json({
            success: true,
            message: `🎉 Đồng bộ Google Drive hoàn tất! Đã thêm ${insertedCount} ảnh mới và dọn dẹp ${deletedCount} ảnh không còn trên Drive.`,
            total_synced_photos: await Photo.countDocuments({ album_id: album._id })
        });

    } catch (error) {
        console.error("❌ Lỗi luồng Đồng bộ Drive:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống đồng bộ Drive: " + error.message });
    }
};

// PATCH /api/album/:id/ban
exports.banAlbum = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: "Chỉ Admin mới có quyền thực hiện hành động khóa Album!" });
        }

        const album = await Album.findById(id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album này trên hệ thống!" });
        }

        album.is_banned = true;
        album.status = 'banned';
        await album.save();

        res.status(200).json({
            success: true,
            message: `🔒 Đã khóa thành công Album "${album.name}"!`,
            data: album
        });

    } catch (error) {
        console.error("❌ Lỗi luồng khóa Album:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi khóa album: " + error.message });
    }
};

// GET /api/album/:id/photos
exports.getAlbumPhotos = async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        // 1. Kiểm tra tính tồn tại của Album
        const album = await Album.findById(id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Album không tồn tại hoặc đã bị gỡ bỏ!" });
        }
        
        if (album.is_locked) {
            if (!req.user || req.user.id !== album.user_id.toString()) {
                return res.status(403).json({ success: false, message: "Album này đã bị khóa bởi Thợ ảnh và không thể truy cập lúc này!" });
            }
        }

        const profile = await PhotographerProfile.findOne({ user_id: album.user_id });

        // Bảo mật phân quyền cho khách hàng (Role customer) và thợ ảnh mua album nhưng không phải là chủ album
        if (req.user && req.user.id !== album.user_id.toString()) {
            const pinProvided = req.query.pin || req.headers['x-album-pin'] || req.query.pin_code;
            const isPinValid = pinProvided && String(pinProvided).trim() === String(album.pin_code).trim();

            // Nếu người dùng có mã PIN đúng -> Cho phép truy cập ngay
            if (!isPinValid) {
                const clientUser = await User.findById(req.user.id);
                if (clientUser) {
                    const customer_email = (clientUser.email || "").toLowerCase().trim();
                    const customer_phone = clientUser.phone || "---nonexistent---";

                    // 1. Kiểm tra xem khách hàng có bản ghi phân quyền truy cập cho ALBUM NÀY không
                    const hasDirectAccess = await CustomerAlbumAccess.findOne({
                        album_id: id,
                        $or: [
                            { customer_email },
                            { customer_phone }
                        ]
                    });

                    if (!hasDirectAccess) {
                        // 2. Kiểm tra xem khách hàng có đơn hàng nào liên kết album này không (delivered_urls)
                        const Order = require('../models/Order');
                        const orderConditions = [{ user_id: clientUser._id }];
                        if (clientUser.phone) orderConditions.push({ phone: clientUser.phone });
                        const hasOrder = await Order.findOne({
                            $or: orderConditions,
                            delivered_urls: { $regex: id }
                        });

                        // 3. Nếu không có đơn hàng → kiểm tra photographer_id liên kết
                        if (!hasOrder) {
                            const photographerId = clientUser.photographer_id;
                            if (!photographerId || album.user_id.toString() !== photographerId.toString()) {
                                return res.status(403).json({ success: false, message: "Tài khoản của bạn không được phân quyền truy cập Album sự kiện này!" });
                            }
                        }
                    }
                }
            }
        }

        // 2. Lấy danh sách ảnh với phân trang, loại bỏ ảnh bị khóa
        const filter = { album_id: id, is_banned: { $ne: true } };
        const photos = await Photo.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // 3. TẠO URL CHÍNH XÁC CHO ẢNH (VPS / GOOGLE DRIVE / S3 / CLOUDFRONT)
        const vpsBase = (process.env.VPS_PUBLIC_URL || 'http://221.132.16.47').replace(/\/+$/, '');
        const photosWithUrls = await Promise.all(photos.map(async (photo) => {
            let url = photo.thumbnail_url;

            // Trường hợp 1: Ảnh lưu trên Cloud VPS NVMe
            if (photo.drive_link && (photo.drive_link.includes('/uploads/') || photo.drive_link.includes('221.132.16.47'))) {
                url = photo.drive_link;
            } else if (photo.drive_file_id && /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(photo.drive_file_id)) {
                url = `${vpsBase}/uploads/${photo.drive_file_id}`;
            }
            // Trường hợp 2: Ảnh lưu trên Google Drive cá nhân
            else if (photo.drive_link && photo.drive_link.includes('google.com')) {
                const match = photo.drive_link.match(/\/d\/([a-zA-Z0-9_-]+)/) || photo.drive_link.match(/id=([a-zA-Z0-9_-]+)/);
                if (match) {
                    url = `https://lh3.googleusercontent.com/d/${match[1]}`;
                }
            } else if (photo.drive_file_id && !photo.drive_file_id.startsWith('demo-') && !photo.drive_file_id.startsWith('mock_') && !photo.drive_file_id.includes('.')) {
                url = `https://lh3.googleusercontent.com/d/${photo.drive_file_id}`;
            }
            // Trường hợp 3: Ảnh lưu trên AWS S3 / CloudFront
            else if (photo.thumbnail_url && !photo.thumbnail_url.startsWith('http')) {
                if (process.env.CLOUDFRONT_DOMAIN) {
                    const cleanDomain = process.env.CLOUDFRONT_DOMAIN.replace(/\/+$/, '');
                    url = `${cleanDomain}/${encodeURI(photo.thumbnail_url).replace(/\+/g, '%2B')}`;
                } else {
                    try {
                        url = await awsS3Service.getPresignedUrl(photo.thumbnail_url);
                    } catch (err) {
                        console.error(`Lỗi tạo presigned URL cho file ${photo.thumbnail_url}:`, err.message);
                    }
                }
            }

            return {
                ...photo.toObject(),
                thumbnail_url: url,
                image_url: url
            };
        }));

        // 4. Đếm tổng số lượng ảnh của album đó
        const totalPhotos = await Photo.countDocuments(filter);

        // Sinh link QR Code tự động
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const albumUrl = `${clientUrl}/album/${album._id.toString()}?pin=${album.pin_code}`;
        const qrCodeUrl = `https://quickchart.io/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(albumUrl)}`;

        res.status(200).json({
            success: true,
            album_name: album.name,
            qr_code_url: qrCodeUrl,
            photographer_id: album.user_id,
            photographer_slug: profile ? profile.slug : null,
            pagination: {
                current_page: page,
                limit: limit,
                total_pages: Math.ceil(totalPhotos / limit),
                total_photos: totalPhotos
            },
            data: photosWithUrls
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy danh sách ảnh: " + error.message });
    }
};

// GET /api/album/client-list -> Khách hàng lấy danh sách Album riêng tư được gán cho mình
exports.getClientAlbums = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(403).json({ success: false, message: "Người dùng không tồn tại." });
        }

        const userEmail = (user.email || "").toLowerCase().trim();
        const userPhone = user.phone || "---nonexistent---";
        const cleanPhone = userPhone.replace(/\D/g, "");

        // 1. Kiểm tra xem khách hàng có các bản ghi truy cập đặc thù bằng email, số điện thoại hoặc tên không
        const accessQuery = [
            { customer_email: userEmail },
            { customer_phone: userPhone }
        ];
        if (cleanPhone && cleanPhone.length >= 9) {
            accessQuery.push({ customer_phone: cleanPhone });
            accessQuery.push({ customer_email: `khach_${cleanPhone}@aurashot.com` });
        }
        if (user.full_name) {
            accessQuery.push({ customer_name: { $regex: new RegExp('^' + user.full_name.trim() + '$', 'i') } });
        }

        const accesses = await CustomerAlbumAccess.find({ $or: accessQuery });
        let albumIdSet = new Set(accesses.map(acc => acc.album_id.toString()));

        // 2. Tìm tất cả các Album gắn với đơn hàng của khách hàng này (delivered_urls)
        const Order = require('../models/Order');
        const orderQuery = [
            { user_id: user._id },
            { phone: userPhone }
        ];
        if (cleanPhone && cleanPhone.length >= 9) {
            orderQuery.push({ phone: cleanPhone });
        }
        if (user.full_name) {
            orderQuery.push({ customer_name: { $regex: new RegExp('^' + user.full_name.trim() + '$', 'i') } });
        }

        const orders = await Order.find({
            $or: orderQuery,
            delivered_urls: { $exists: true, $ne: [] }
        });

        orders.forEach(order => {
            (order.delivered_urls || []).forEach(url => {
                const match = url.match(/\/album\/([a-f0-9]{24})/i);
                if (match && match[1]) {
                    albumIdSet.add(match[1]);
                }
            });
        });

        // 3. Tìm các Album được tạo trực tiếp cho khách hàng (theo customer_email / phone / name)
        const albumQuery = [
            { customer_email: userEmail },
            { customer_phone: userPhone }
        ];
        if (cleanPhone && cleanPhone.length >= 9) {
            albumQuery.push({ customer_phone: cleanPhone });
            albumQuery.push({ customer_email: `khach_${cleanPhone}@aurashot.com` });
        }
        if (user.full_name) {
            albumQuery.push({ name: { $regex: new RegExp(user.full_name.trim(), 'i') } });
        }

        const directAlbums = await Album.find({
            $or: albumQuery,
            is_banned: { $ne: true },
            is_locked: { $ne: true }
        }).select('_id');
        directAlbums.forEach(a => albumIdSet.add(a._id.toString()));

        // 4. Nếu khách hàng có liên kết với photographer_id
        if (user.photographer_id) {
            const photoAlbums = await Album.find({
                user_id: user.photographer_id,
                is_banned: { $ne: true },
                is_locked: { $ne: true }
            }).select('_id');
            photoAlbums.forEach(a => albumIdSet.add(a._id.toString()));
        }

        const allowedAlbumIds = Array.from(albumIdSet);
        const filteredAlbums = await Album.find({ 
            _id: { $in: allowedAlbumIds }, 
            is_banned: { $ne: true },
            is_locked: { $ne: true }
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: filteredAlbums.length,
            data: filteredAlbums
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy danh sách album khách hàng: " + error.message });
    }
};

// POST /api/album/:id/access -> Thợ ảnh phân quyền cho khách hàng cụ thể được xem album
exports.grantAlbumAccess = async (req, res) => {
    try {
        const { id } = req.params; // Album ID
        const { customer_email, customer_name, customer_phone } = req.body;

        if (!customer_email) {
            return res.status(400).json({ 
                success: false, 
                message: "Vui lòng nhập Email khách hàng!" 
            });
        }

        const album = await Album.findById(id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album yêu cầu!" });
        }

        // Kiểm tra quyền sở hữu Album
        if (album.user_id.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: "Bạn không có quyền cấp quyền truy cập cho Album này!" });
        }

        // Tạo hoặc tìm bản ghi phân quyền truy cập
        let access = await CustomerAlbumAccess.findOne({ album_id: id, customer_email: customer_email.toLowerCase().trim() });
        if (!access) {
            access = await CustomerAlbumAccess.create({
                album_id: id,
                customer_email: customer_email.toLowerCase().trim(),
                customer_name: customer_name || "Khách hàng",
                customer_phone: customer_phone || ""
            });
        }

        return res.status(201).json({
            success: true,
            message: "🎉 Cấp quyền truy cập Album cho khách hàng thành công!",
            data: access
        });

    } catch (error) {
        console.error("❌ Lỗi cấp quyền truy cập Album:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống cấp quyền truy cập: " + error.message });
    }
};

// POST /api/album/:id/submit-selection
exports.submitSelection = async (req, res) => {
    try {
        const { id } = req.params;
        const { selected_photo_ids, notes } = req.body;

        if (!Array.isArray(selected_photo_ids)) {
            return res.status(400).json({ success: false, message: "Danh sách ảnh đã chọn không hợp lệ." });
        }

        const album = await Album.findById(id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album yêu cầu!" });
        }

        if (notes !== undefined) {
            album.retouch_notes = notes;
            await album.save();
        }

        // Cập nhật trạng thái is_favorited cho các ảnh được chọn
        await Photo.updateMany(
            { _id: { $in: selected_photo_ids }, album_id: id },
            { $set: { is_favorited: true } }
        );

        // Hủy favorited cho các ảnh bị bỏ chọn trong album này
        await Photo.updateMany(
            { _id: { $nin: selected_photo_ids }, album_id: id },
            { $set: { is_favorited: false } }
        );

        const customer_name = req.user && req.user.full_name ? req.user.full_name : "Khách hàng";

        const Notification = require('../models/Notification');
        const noteMessage = notes ? `\n📝 Ghi chú từ khách: "${notes}"` : '';
        await Notification.create({
            user_id: album.user_id,
            title: 'Khách hàng đã gửi yêu cầu hậu kỳ',
            message: `${customer_name} vừa chốt ${selected_photo_ids.length} ảnh trong album "${album.name}" và gửi yêu cầu hậu kỳ.${noteMessage}`
        });

        res.status(200).json({
            success: true,
            message: "Gửi yêu cầu chỉnh sửa ảnh thành công! Thợ ảnh đã được thông báo."
        });
    } catch (error) {
        console.error("Lỗi khi khách hàng gửi danh sách chọn ảnh:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

exports.updateAlbum = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, pin_code, auto_delete_album_days } = req.body;
        const user_id = req.user.id;

        const album = await Album.findOne({ _id: id, user_id });
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album hoặc bạn không có quyền sửa!" });
        }

        if (name) {
            const textMod = moderationService.checkText(name);
            if (textMod.isViolated) {
                return res.status(400).json({ success: false, message: `Tên album chứa từ ngữ nhạy cảm: "${textMod.matchedWord}"` });
            }
            album.name = name;
        }

        if (pin_code) {
            album.pin_code = pin_code;
        }

        // Cập nhật số ngày lưu trữ & tính lại expires_at
        if (auto_delete_album_days !== undefined) {
            if (auto_delete_album_days === null || auto_delete_album_days === "" || auto_delete_album_days === 0) {
                // Xóa hạn lưu trữ → lưu vĩnh viễn
                album.expires_at = null;
            } else {
                const days = Number(auto_delete_album_days);
                if (!isNaN(days) && days > 0) {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + days);
                    album.expires_at = expiresAt;
                }
            }
        }

        await album.save();

        res.status(200).json({
            success: true,
            message: "Cập nhật Album thành công!",
            data: album
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật album: " + error.message });
    }
};

exports.toggleLock = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const album = await Album.findOne({ _id: id, user_id });
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album hoặc bạn không có quyền!" });
        }

        album.is_locked = !album.is_locked;
        await album.save();

        res.status(200).json({
            success: true,
            message: album.is_locked ? "Đã khóa Album!" : "Đã mở khóa Album!",
            data: album
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi khóa/mở album: " + error.message });
    }
};

// PATCH /api/albums/:id/toggle-public
exports.togglePublic = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const album = await Album.findOne({ _id: id, user_id });
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album hoặc bạn không có quyền!" });
        }

        // Nếu album bị ban hoặc là_safe=false thì không cho bật public
        if (!album.is_public && (album.is_banned || !album.is_safe)) {
            return res.status(403).json({ success: false, message: "Album này đã bị hệ thống kiểm duyệt và không được phép hiển thị công khai!" });
        }

        album.is_public = !album.is_public;
        await album.save();

        res.status(200).json({
            success: true,
            message: album.is_public ? "Album đã được hiển thị công khai trên trang chủ!" : "Album đã được ẩn khỏi trang chủ!",
            data: { _id: album._id, is_public: album.is_public }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật trạng thái công khai: " + error.message });
    }
};

// GET /api/album/public/trending
exports.getTrendingAlbums = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        // Dùng aggregation để lấy album public và join với photographer profile để lấy rating
        const trendingAlbums = await Album.aggregate([
            { 
                $match: { 
                    is_public: true, 
                    is_safe: true, 
                    is_banned: false, 
                    status: 'active' 
                } 
            },
            {
                $lookup: {
                    from: 'photographerprofiles', // Tên collection trong DB (Mongoose tự động chuyển sang số nhiều và chữ thường)
                    localField: 'user_id',
                    foreignField: 'user_id',
                    as: 'photographer_profile'
                }
            },
            {
                // Giữ lại các album kể cả khi chưa có profile (nếu muốn) 
                // hoặc bắt buộc phải có profile thì dùng preserveNullAndEmptyArrays: false
                $unwind: {
                    path: '$photographer_profile',
                    preserveNullAndEmptyArrays: false 
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'photographer_user'
                }
            },
            {
                $unwind: {
                    path: '$photographer_user',
                    preserveNullAndEmptyArrays: false 
                }
            },
            {
                // Sắp xếp: Ưu tiên điểm đánh giá cao, sau đó đến số lượng đánh giá, rồi mới đến ngày tạo
                $sort: { 
                    'photographer_profile.average_rating': -1, 
                    'photographer_profile.review_count': -1,
                    createdAt: -1 
                }
            },
            {
                $lookup: {
                    from: 'photos',
                    localField: '_id',
                    foreignField: 'album_id',
                    pipeline: [
                        { $match: { is_safe: true, is_banned: false } },
                        { $limit: 1 }
                    ],
                    as: 'cover_photos'
                }
            },
            {
                $addFields: {
                    cover_photo: { $arrayElemAt: ['$cover_photos', 0] }
                }
            },
            {
                // Chọn lọc lại dữ liệu trả về cho gọn nhẹ
                $project: {
                    name: 1,
                    is_locked: 1,
                    createdAt: 1,
                    cover_url: '$cover_photo.thumbnail_url',
                    drive_file_id: '$cover_photo.drive_file_id',
                    drive_link: '$cover_photo.drive_link',
                    photographer_id: '$user_id',
                    photographer_name: '$photographer_user.full_name',
                    photographer_avatar: '$photographer_profile.cover_image_url',
                    average_rating: '$photographer_profile.average_rating',
                    review_count: '$photographer_profile.review_count'
                }
            }
        ]);

        const albumsWithUrls = await Promise.all(trendingAlbums.map(async (album) => {
            let cover_url = album.cover_url;
            
            // 1. VPS Cloud Storage
            if (album.drive_link && (album.drive_link.includes('/uploads/') || album.drive_link.includes('221.132.16.47'))) {
                cover_url = album.drive_link;
            } else if (album.drive_file_id && /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(album.drive_file_id)) {
                cover_url = `http://221.132.16.47/uploads/${album.drive_file_id}`;
            }
            // 2. Google Drive link trực tiếp qua CDN lh3
            else if (album.drive_link && album.drive_link.includes('google.com')) {
                const match = album.drive_link.match(/\/d\/([a-zA-Z0-9_-]+)/) || album.drive_link.match(/id=([a-zA-Z0-9_-]+)/);
                if (match) cover_url = `https://lh3.googleusercontent.com/d/${match[1]}`;
            } else if (album.drive_file_id && !album.drive_file_id.startsWith('demo-') && !album.drive_file_id.startsWith('mock_') && !album.drive_file_id.includes('.')) {
                cover_url = `https://lh3.googleusercontent.com/d/${album.drive_file_id}`;
            } else if (cover_url && !cover_url.startsWith('http')) {
                if (process.env.CLOUDFRONT_DOMAIN) {
                    const cleanDomain = process.env.CLOUDFRONT_DOMAIN.replace(/\/+$/, '');
                    cover_url = `${cleanDomain}/${encodeURI(cover_url).replace(/\+/g, '%2B')}`;
                } else {
                    try {
                        cover_url = await awsS3Service.getPresignedUrl(cover_url);
                    } catch (e) {
                        console.error('Lỗi tạo presigned URL cho ảnh bìa album:', e);
                    }
                }
            }

            // Fallback nếu album chưa có ảnh tải lên
            if (!cover_url) {
                cover_url = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800';
            }

            return {
                ...album,
                cover_url
            };
        }));

        res.status(200).json({
            success: true,
            count: albumsWithUrls.length,
            data: albumsWithUrls
        });
    } catch (error) {
        console.error("Lỗi lấy album trending:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy album trending: " + error.message });
    }
};
