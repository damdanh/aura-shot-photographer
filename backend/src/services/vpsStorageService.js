const Client = require('ssh2-sftp-client');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const config = {
    host: process.env.VPS_HOST,
    port: process.env.VPS_PORT || 22,
    username: process.env.VPS_USER,
    password: process.env.VPS_PASSWORD
};

// Base URL để frontend hiển thị ảnh
const publicUrl = process.env.VPS_PUBLIC_URL || `http://${process.env.VPS_HOST}`;
const uploadDir = '/var/www/aura-shot/uploads';

class VpsStorageService {
    /**
     * Upload ảnh lên VPS thông qua giao thức SFTP
     * @param {Buffer} fileBuffer Buffer của file ảnh
     * @param {String} originalName Tên gốc của file
     * @returns {Object} { fileName, fileUrl }
     */
    async uploadPhotoToVPS(fileBuffer, originalName) {
        const sftp = new Client();
        try {
            // Đảm bảo tên file duy nhất (UUID/Timestamp + Original)
            const ext = path.extname(originalName);
            const baseName = path.basename(originalName, ext).replace(/\s+/g, '-');
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileName = `${baseName}-${uniqueSuffix}${ext}`;
            
            const remotePath = `${uploadDir}/${fileName}`;

            // Kết nối SFTP và đẩy file lên
            await sftp.connect(config);
            await sftp.put(fileBuffer, remotePath);

            const fileUrl = `${publicUrl}/uploads/${fileName}`;

            return {
                fileName,
                fileUrl
            };
        } catch (error) {
            console.error('❌ Lỗi upload VPS (SFTP):', error.message);
            throw error;
        } finally {
            sftp.end(); // Luôn đóng kết nối sau khi tải xong
        }
    }

    /**
     * Xóa ảnh khỏi VPS
     * @param {String} fileName Tên file cần xóa trên VPS
     */
    async deletePhotoFromVPS(fileName) {
        const sftp = new Client();
        try {
            await sftp.connect(config);
            const remotePath = `${uploadDir}/${fileName}`;
            
            // Kiểm tra file tồn tại trước khi xóa
            const exists = await sftp.exists(remotePath);
            if (exists) {
                await sftp.delete(remotePath);
                console.log(`Đã xóa file ${fileName} trên VPS.`);
            }
        } catch (error) {
            console.error('❌ Lỗi xóa file VPS (SFTP):', error.message);
            throw error;
        } finally {
            sftp.end();
        }
    }
}

module.exports = new VpsStorageService();
