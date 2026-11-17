// backend/src/controllers/photoController.js
const mongoose = require('mongoose');
const Photo = require('../models/Photo');
const Album = require('../models/Album');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const heicConvert = require('heic-convert');
const awsS3Service = require('../services/awsS3Service');
const awsRekognitionService = require('../services/awsRekognitionService');
const moderationService = require('../services/moderationService');
const Notification = require('../models/Notification');
const googleDriveService = require('../services/googleDriveService');
const vpsStorageService = require('../services/vpsStorageService');
const { photoQueue } = require('../queues/photoQueue');

async function handleHeicFile(file) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.heic' || ext === '.heif') {
        const fileBuffer = fs.readFileSync(file.path);
        const convertedBuffer = await heicConvert({
            buffer: fileBuffer,
            format: 'JPEG',
            quality: 0.9,
            maxMemoryUsageInMB: 512
        });

        file.originalname = file.originalname.replace(/\.(heic|heif)$/i, '.jpg');
        file.mimetype = 'image/jpeg';
        return convertedBuffer;
    }
    return fs.readFileSync(file.path);
}

/**
 * API Upload Photos: Tải ảnh trực tiếp lên Google Drive và đánh chỉ mục lên AWS Rekognition
 * MongoDB siêu nhẹ: Không lưu thông tin ảnh vào database nữa.
 */
exports.uploadPhotos = async (req, res) => {
    try {
        const { album_id } = req.body;
        const files = Array.isArray(req.files) ? req.files : (req.files && req.files.photos) ? req.files.photos : [];
        
        if (files.length === 0) {
            return res.status(400).json({ success: false, message: "Không có ảnh nào được gửi lên." });
        }
        if (!album_id) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin album_id!" });
        }

        const album = await Album.findById(album_id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Album không tồn tại!" });
        }

        const photographer = await User.findById(album.user_id);
        const isConnected = photographer?.googleDrive?.isConnected || false;
        const customRefreshToken = isConnected ? photographer.googleDrive.refreshToken : null;
        const driveFolderId = album.drive_folder_id;

        // KIỂM TRA GIỚI HẠN GÓI SaaS
        const UserPackage = require('../models/UserPackage');
        const activeSub = await UserPackage.findOne({
            user_id: album.user_id,
            status: 'active',
            expired_at: { $gt: new Date() }
        }).populate('package_id');

        if (!activeSub || !activeSub.package_id) {
            return res.status(403).json({ success: false, message: "Thợ ảnh chưa đăng ký gói dịch vụ hoặc gói đã hết hạn!" });
        }

        const maxPhotos = activeSub.package_id.max_photos;
        const storageGb = activeSub.package_id.storage_gb;

        let incomingBytes = 0;
        files.forEach(f => incomingBytes += (f.size || 0));

        if (maxPhotos !== -1) {
            const userAlbums = await Album.find({ user_id: album.user_id }).select('_id');
            const currentPhotoCount = await Photo.countDocuments({ album_id: { $in: userAlbums } });
            if (currentPhotoCount + files.length > maxPhotos) {
                return res.status(403).json({ success: false, message: `Gói dịch vụ chỉ cho phép tải lên tối đa ${maxPhotos} ảnh. Bạn đã vượt giới hạn (Đang tải thêm ${files.length} ảnh)!` });
            }
        }

        if (storageGb !== -1 && !isConnected) {
            const maxBytes = storageGb * 1024 * 1024 * 1024;
            const usedBytes = photographer.used_storage_bytes || 0;
            if (usedBytes + incomingBytes > maxBytes) {
                return res.status(403).json({ success: false, message: `Dung lượng tải lên vượt quá giới hạn gói (${storageGb} GB). Vui lòng nâng cấp gói hoặc kết nối Drive cá nhân!` });
            }
        }

        // Đảm bảo Collection tương ứng trên AWS Rekognition đã được tạo
        await awsRekognitionService.createFaceCollection(driveFolderId);

        const uploadedPhotos = [];
        const failedPhotos = [];
        let totalUploadedBytes = 0;

        const chunkSize = 5; // Xử lý song song 5 ảnh cùng lúc
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            
            await Promise.all(chunk.map(async (file) => {
                try {
                    // Đã chuyển phần decode sang multer (photoRoutes.js) để tránh lỗi ghi file sai tên

                    // 1. Đọc và chuẩn hóa Buffer ảnh gốc (Xử lý HEIC nếu có)
                    const fileBuffer = await handleHeicFile(file);

                    // 2. Tải ẢNH GỐC lên VPS riêng qua SFTP
                    let vpsFileInfo = { fileName: null, fileUrl: null };
                    try {
                        vpsFileInfo = await vpsStorageService.uploadPhotoToVPS(
                            fileBuffer,
                            file.originalname
                        );
                    } catch (vpsErr) {
                        console.error(`⚠️ Lỗi khi đồng bộ ảnh gốc "${file.originalname}" lên VPS:`, vpsErr.message);
                    }

                    // 3. Tạo ảnh thu nhỏ (Thumbnail 400px) để lưu trên AWS S3
                    let thumbnailBuffer = fileBuffer; // Fallback: Dùng ảnh gốc nếu Jimp quá tải RAM
                    try {
                        const jimpImage = await Jimp.fromBuffer(fileBuffer);
                        if (jimpImage.bitmap.width > 400) {
                            jimpImage.resize({ w: 400 });
                        }
                        thumbnailBuffer = await jimpImage.getBuffer('image/jpeg');
                    } catch (jimpErr) {
                        console.warn(`⚠️ Bỏ qua nén ảnh cho "${file.originalname}" do Jimp quá tải RAM (lỗi: ${jimpErr.message}). Sẽ đẩy ảnh gốc lên S3 làm thumbnail.`);
                    }

                    // 4. TẢI ẢNH THU NHỎ LÊN S3
                    const s3Key = `albums/${album_id}/${Date.now()}_thumbnail_${file.originalname}`;
                    await awsS3Service.uploadToS3(thumbnailBuffer, s3Key, 'image/jpeg');

                    // 5. Lưu thông tin ảnh vào MongoDB
                    const newPhoto = new Photo({
                        album_id,
                        file_name: vpsFileInfo.fileName || file.originalname,
                        thumbnail_url: s3Key,
                        drive_file_id: vpsFileInfo.fileName, // Tái sử dụng trường này để lưu tên file VPS
                        drive_link: vpsFileInfo.fileUrl,     // Tái sử dụng để lưu link tĩnh VPS
                        is_banned: false,
                        file_size: file.size || 0,
                        face: []
                    });
                    await newPhoto.save();
                    totalUploadedBytes += file.size || 0;

                    // 5. Thêm tác vụ xử lý AI ngầm vào hàng đợi BullMQ
                    try {
                        await photoQueue.add(`process-${newPhoto._id}`, {
                            photoId: newPhoto._id,
                            s3Key: s3Key,
                            albumId: album_id,
                            albumName: album.name,
                            userId: album.user_id
                        });
                    } catch (queueErr) {
                        console.error(`[Queue Error] Không thể đẩy ảnh ${file.originalname} vào hàng đợi xử lý AI:`, queueErr.message);
                    }

                    uploadedPhotos.push({ file_name: file.originalname, status: 'processing' });

                } catch (fileError) {
                    console.error(`Lỗi xử lý file ${file.originalname}:`, fileError);
                    failedPhotos.push({ file_name: file.originalname, error: fileError.message });
                } finally {
                    // Xóa file lưu tạm thời cục bộ trên server
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                }
            }));
        }

        // 6. Cập nhật dung lượng bộ nhớ đã dùng nếu lưu trên hệ thống (không dùng Google Drive cá nhân)
        if (!isConnected && totalUploadedBytes > 0) {
            await User.findByIdAndUpdate(album.user_id, {
                $inc: { used_storage_bytes: totalUploadedBytes }
            });
        }

        return res.status(200).json({
            success: true,
            message: `Tải lên và lập chỉ mục hoàn tất. Thành công: ${uploadedPhotos.length}, Thất bại: ${failedPhotos.length}`,
            uploaded: uploadedPhotos,
            failed: failedPhotos
        });

    } catch (error) {
        console.error("❌ Lỗi hệ thống upload:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống upload: " + error.message });
    }
};

exports.searchPhotosByFace = async (req, res) => {
    const selfieFile = req.file || (req.files && req.files[0]);
    const { album_id, drive_folder_id } = req.body;

    if (!selfieFile) {
        return res.status(400).json({ success: false, message: "Vui lòng upload 1 ảnh Selfie!" });
    }

    try {
        let selfieBuffer = await handleHeicFile(selfieFile);

        // Nén ảnh Selfie bằng Jimp để đảm bảo dung lượng gửi cho AWS Rekognition luôn dưới 5MB
        try {
            const jimpSelfie = await Jimp.fromBuffer(selfieBuffer);
            if (jimpSelfie.bitmap.width > 1200) {
                jimpSelfie.resize({ w: 1200 }); // Thu nhỏ chiều ngang tối đa 1200px
            }
            // Xuất ra buffer JPEG chất lượng 80%
            selfieBuffer = await jimpSelfie.getBuffer('image/jpeg', { quality: 80 });
        } catch (jimpErr) {
            console.warn("⚠️ Không thể nén ảnh Selfie, sẽ gửi ảnh gốc cho AWS:", jimpErr.message);
        }

        // Trường hợp 1: Sử dụng album_id (Tối ưu hóa với S3 và MongoDB)
        if (album_id) {
            const collectionId = `album_${album_id}`;
            const matchedFaces = await awsRekognitionService.searchFacesBySelfie(collectionId, selfieBuffer);

            if (matchedFaces.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: "Không tìm thấy ảnh phù hợp trong Album này.",
                    data: []
                });
            }

            const s3Keys = [...new Set(matchedFaces.map(f => f.s3Key))];

            console.log(`[AI Face Search] Querying Photo.find with album_id: ${album_id} and keys:`, s3Keys);
            const matchedPhotos = await Photo.find({
                album_id: new mongoose.Types.ObjectId(album_id),
                thumbnail_url: { $in: s3Keys }
            });
            console.log(`[AI Face Search] MongoDB query matched ${matchedPhotos.length} photos.`);
            
            const matchedPhotosWithUrls = await Promise.all(matchedPhotos.map(async (photo) => {
                let url = photo.thumbnail_url;
                if (photo.thumbnail_url && !photo.thumbnail_url.startsWith('http')) {
                    try {
                        url = await awsS3Service.getPresignedUrl(photo.thumbnail_url);
                    } catch (err) {
                        console.error("Lỗi tạo presigned URL:", err.message);
                    }
                }
                return {
                    ...photo.toObject(),
                    thumbnail_url: url
                };
            }));

            return res.status(200).json({
                success: true,
                message: `Tìm thấy ${matchedPhotosWithUrls.length} ảnh phù hợp trong Album này.`,
                data: matchedPhotosWithUrls
            });
        } 
        
        // Trường hợp 2: Sử dụng drive_folder_id (Lộc's direct Drive flow)
        if (drive_folder_id) {
            console.log(`🔍 [Face Search] Tìm kiếm trực tiếp trên Drive Folder ID: ${drive_folder_id}`);
            const matchedUrls = await awsRekognitionService.searchFacesByImage(drive_folder_id, selfieBuffer);
            return res.status(200).json({
                success: true,
                message: `Tìm thấy ${matchedUrls.length} bức ảnh phù hợp.`,
                data: matchedUrls
            });
        }

        return res.status(400).json({ 
            success: false, 
            message: "Thiếu thông tin album_id hoặc drive_folder_id để giới hạn phạm vi tìm kiếm!" 
        });

    } catch (error) {
        console.error("Lỗi luồng Search Face:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống search: " + error.message });
    } finally {
        if (selfieFile && selfieFile.path && fs.existsSync(selfieFile.path)) {
            fs.unlinkSync(selfieFile.path);
        }
    }
};

exports.cleanAllData = async (req, res) => {
    try {
        const { admin_key } = req.body;
        const MASTER_KEY = process.env.ADMIN_MASTER_KEY || "AuraShotAdmin2026";

        if (!admin_key || admin_key !== MASTER_KEY) {
            return res.status(403).json({
                success: false,
                message: "Quyền truy cập bị từ chối!"
            });
        }

        const allPhotos = await Photo.find({});
        console.log(`[Admin Service] Bắt đầu dọn dẹp ${allPhotos.length} ảnh...`);

        for (const photo of allPhotos) {
            // Dọn dẹp ảnh S3 mới
            if (photo.thumbnail_url && !photo.thumbnail_url.startsWith('http')) {
                try {
                    await awsS3Service.deleteFromS3(photo.thumbnail_url);
                } catch (s3Err) {
                    console.error("Lỗi dọn S3:", s3Err.message);
                }
            }
        }

        // Xóa toàn bộ dữ liệu trong bảng Photo MongoDB
        await Photo.deleteMany({});

        res.status(200).json({
            success: true,
            message: "Đã quét sạch bách toàn bộ dữ liệu ảnh trên S3, Google Drive và MongoDB thành công!"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi dọn dẹp dữ liệu: " + error.message });
    }
};

/**
 * Lấy danh sách ảnh trực tiếp từ thư mục Google Drive của Album (Không cần model Photo)
 */
exports.getPhotosByAlbum = async (req, res) => {
    try {
        const { id: album_id } = req.params;
        const album = await Album.findById(album_id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Không tìm thấy Album!" });
        }

        // Lấy danh sách ảnh từ MongoDB thay vì gọi Google Drive
        const photos = await Photo.find({ album_id });
        
        const photoUrls = photos.map(photo => ({
            file_name: photo.file_name,
            url: photo.drive_link || photo.thumbnail_url
        }));

        return res.status(200).json({
            success: true,
            count: photoUrls.length,
            data: photoUrls
        });
    } catch (error) {
        console.error("❌ Lỗi lấy danh sách ảnh album từ Drive:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống lấy danh sách ảnh: " + error.message });
    }
};
// 1. API: Cấp Pre-signed URL cho client để tự đẩy ảnh lên S3
exports.getUploadUrl = async (req, res) => {
    try {
        const { album_id, file_name, file_type } = req.body;

        if (!album_id || !file_name || !file_type) {
            return res.status(400).json({ success: false, message: "Thiếu album_id, file_name hoặc file_type!" });
        }

        const album = await Album.findById(album_id);
        if (!album) {
            return res.status(404).json({ success: false, message: "Album không tồn tại!" });
        }

        // Tạo S3 Key duy nhất
        const s3Key = `albums/${album_id}/${Date.now()}_${file_name}`;

        // Sinh link upload trực tiếp
        const uploadUrl = await awsS3Service.getUploadPresignedUrl(s3Key, file_type);

        res.status(200).json({
            success: true,
            uploadUrl,
            s3Key
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi sinh URL upload: " + error.message });
    }
};

// 2. API: Xác nhận ảnh đã lên S3 thành công -> lưu vào DB và kích hoạt AI quét ngầm
exports.confirmUpload = async (req, res) => {
    try {
        const { album_id, file_name, s3Key } = req.body;

        if (!album_id || !file_name || !s3Key) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin xác nhận!" });
        }

        const currentAlbum = await Album.findById(album_id);
        if (!currentAlbum) {
            return res.status(404).json({ success: false, message: "Album không tồn tại!" });
        }

        const photographer = await User.findById(currentAlbum.user_id);
        const customRefreshToken = photographer?.googleDrive?.isConnected ? photographer.googleDrive.refreshToken : null;

        // Tạo bản ghi Photo trong MongoDB
        const newPhoto = new Photo({
            album_id,
            file_name,
            thumbnail_url: s3Key,
            is_banned: false,
            face: []
        });
        await newPhoto.save();

        // Kích hoạt xử lý AI chạy ngầm
        setImmediate(async () => {
            try {
                // 1. Trích xuất khuôn mặt (AWS Rekognition)
                const collectionId = `album_${album_id}`;
                let detectedFaces = [];
                try {
                    detectedFaces = await awsRekognitionService.indexFacesInPhoto(collectionId, s3Key);
                } catch (awsError) {
                    console.error(` [Presigned AI] Rekognition lỗi ảnh ${file_name}:`, awsError.message);
                }

                 // 2. Tải ảnh từ S3 về Buffer để Google Vision quét
                let isPhotoBanned = false;
                let fileBuffer = null;
                try {
                    fileBuffer = await awsS3Service.downloadFromS3(s3Key);
                    isPhotoBanned = await moderationService.checkImageViolation(fileBuffer);
                } catch (moderationErr) {
                    console.error(`[Presigned AI] Vision lỗi ảnh ${file_name}:`, moderationErr.message);
                }

                // 2.1. Đẩy ảnh gốc từ buffer tải từ S3 lên VPS
                let vpsFileInfo = { fileName: null, fileUrl: null };
                if (fileBuffer) {
                    try {
                        vpsFileInfo = await vpsStorageService.uploadPhotoToVPS(
                            fileBuffer,
                            file_name
                        );
                    } catch (vpsErr) {
                        console.error(`Lỗi khi đồng bộ ảnh gốc "${file_name}" từ S3 lên VPS:`, vpsErr.message);
                    }
                }

                // 3. Cập nhật kết quả vào DB
                newPhoto.face = detectedFaces.map(f => ({
                    box: f.box,
                    descriptor: []
                }));
                newPhoto.is_banned = isPhotoBanned;
                newPhoto.drive_file_id = vpsFileInfo.fileName;
                newPhoto.drive_link = vpsFileInfo.fileUrl;
                await newPhoto.save();


                // 4. Bắn thông báo nếu vi phạm chính sách
                if (isPhotoBanned) {
                    await Notification.create({
                        user_id: currentAlbum.user_id,
                        title: 'Ảnh vi phạm chính sách',
                        message: `Ảnh "${file_name}" tải lên trực tiếp trong Album "${currentAlbum.name}" vi phạm chính sách nội dung.`
                    });
                }
                console.log(`[Presigned AI] Đã xử lý xong ảnh tải trực tiếp: ${file_name}`);
            } catch (bgError) {
                console.error(` [Presigned AI] Lỗi nặng xử lý ngầm ảnh ${file_name}:`, bgError.message);
            }
        });

        res.status(201).json({
            success: true,
            message: "Xác nhận tải ảnh thành công, hệ thống đang xử lý AI!",
            data: newPhoto
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi xác nhận tải ảnh: " + error.message });
    }
};
