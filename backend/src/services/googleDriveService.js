const { google } = require('googleapis');

/**
 * Khởi tạo Google Drive Client
 * @param {string} customRefreshToken Refresh Token riêng của thợ ảnh (nếu có)
 * @returns {object|null} Google Drive Client instance hoặc null nếu thiếu cấu hình
 */
function getDriveClient(customRefreshToken = null) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Ưu tiên sử dụng Token động của thợ ảnh, nếu không có thì fallback về Token chung trong .env
    const refreshToken = customRefreshToken || process.env.GOOGLE_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
        try {
            const auth = new google.auth.OAuth2(
                clientId,
                clientSecret,
                process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
            );
            auth.setCredentials({
                refresh_token: refreshToken
            });
            return google.drive({ version: 'v3', auth });
        } catch (error) {
            console.error("❌ Lỗi cấu hình Google Drive OAuth2 Client:", error.message);
            return null;
        }
    }

    // Nếu không cấu hình OAuth2, kiểm tra cấu hình Service Account JWT cũ làm fallback
    if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
        try {
            let privateKey = process.env.GOOGLE_PRIVATE_KEY.trim();
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                privateKey = privateKey.slice(1, -1);
            }
            if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
                privateKey = privateKey.slice(1, -1);
            }
            privateKey = privateKey.trim().replace(/\\n/g, '\n');

            const auth = new google.auth.JWT({
                email: process.env.GOOGLE_CLIENT_EMAIL,
                key: privateKey,
                scopes: ['https://www.googleapis.com/auth/drive']
            });
            return google.drive({ version: 'v3', auth });
        } catch (error) {
            console.error("❌ Lỗi cấu hình Google Drive Service Account Client:", error.message);
            return null;
        }
    }

    console.warn("⚠️ CẢNH BÁO: Chưa cấu hình đầy đủ thông tin Google Drive. Sử dụng Mock Drive.");
    return null;
}

/**
 * 1. Tạo thư mục mới trên Google Drive cho Album
 * @param {string} folderName Tên của Album
 * @param {string} parentFolderId ID thư mục cha
 * @param {string} customRefreshToken Refresh Token riêng của thợ ảnh (nếu có)
 * @returns {Promise<string>} ID thư mục vừa tạo trên Drive
 */
exports.createAlbumFolder = async (folderName, parentFolderId = null, customRefreshToken = null) => {
    const drive = getDriveClient(customRefreshToken);
    if (!drive) {
        return `mock_drive_folder_${Date.now()}`;
    }
    try {
        const finalParentId = parentFolderId || process.env.DRIVE_PARENT_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: finalParentId ? [finalParentId] : []
        };
        const folder = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });
        
        // Chia sẻ thư mục công khai để khách hàng có thể đọc được file bên trong
        try {
            await drive.permissions.create({
                fileId: folder.data.id,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });
        } catch (permErr) {
            console.warn("Không thể phân quyền thư mục cho 'anyone':", permErr.message);
        }

        console.log(`[Drive Service] Đã tạo thư mục Album: "${folderName}" (ID: ${folder.data.id})`);
        return folder.data.id;
    } catch (error) {
        console.error("Lỗi khi tạo thư mục trên Drive:", error.message);
        throw error;
    }
};

/**
 * 2. Upload file ảnh gốc trực tiếp lên thư mục Google Drive
 * @param {Buffer} fileBuffer Dữ liệu nhị phân của ảnh
 * @param {string} fileName Tên file ảnh
 * @param {string} mimeType Định dạng file
 * @param {string} folderId ID thư mục chứa ảnh trên Drive
 * @param {string} customRefreshToken Refresh Token riêng của thợ ảnh (nếu có)
 * @returns {Promise<{fileId: string, webViewLink: string}>} ID file và Link xem/tải ảnh
 */
exports.uploadPhotoToFolder = async (fileBuffer, fileName, mimeType, folderId, customRefreshToken = null) => {
    const drive = getDriveClient(customRefreshToken);
    if (!drive) {
        return {
            fileId: `mock_file_${Date.now()}`,
            webViewLink: `https://drive.google.com/mock_file_link`
        };
    }
    try {
        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        };
        const { Readable } = require('stream');
        const bufferStream = new Readable();
        bufferStream.push(fileBuffer);
        bufferStream.push(null);

        const media = {
            mimeType: mimeType,
            body: bufferStream
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        // Chia sẻ công khai để khách mua ảnh có link là xem được ảnh gốc
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        console.log(`[Drive Service] Upload thành công file "${fileName}" lên Drive.`);
        return {
            fileId: response.data.id,
            webViewLink: response.data.webViewLink
        };
    } catch (error) {
        console.error(`[Drive Service] Lỗi upload file "${fileName}":`, error.message);
        throw error;
    }
};

/**
 * 3. Tạo OAuth Client dùng chung cho các hàm xác thực/liên kết
 * @returns {object} Google OAuth2 Client
 */
function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

/**
 * 4. Sinh link yêu cầu cấp quyền Google Drive cho thợ ảnh
 * @returns {string} URL xác thực Google
 */
exports.generateAuthUrl = () => {
    const oauth2Client = getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', 
        prompt: 'consent',     
        scope: ['https://www.googleapis.com/auth/drive.file']
    });
};

/**
 * 5. Đổi mã authorization code lấy tokens
 * @param {string} code Mã authorization code nhận về từ Google redirect callback
 * @returns {Promise<object>} Đối tượng chứa tokens
 */
exports.getTokensFromCode = async (code) => {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

/**
 * 6. Tạo thư mục gốc riêng cho thợ ảnh trên Drive cá nhân của họ
 * @param {string} refreshToken Refresh Token của thợ ảnh
 * @returns {Promise<string>} ID của thư mục gốc vừa tạo
 */
exports.createRootFolderForPhotographer = async (refreshToken) => {
    const drive = getDriveClient(refreshToken);
    if (!drive) {
        throw new Error("Không thể khởi tạo Drive Client từ Refresh Token của thợ ảnh.");
    }
    try {
        const response = await drive.files.create({
            requestBody: {
                name: 'AuraShot_Albums',
                mimeType: 'application/vnd.google-apps.folder'
            },
            fields: 'id'
        });
        console.log(`[Drive Service] Đã tạo thư mục gốc "AuraShot_Albums" trên Drive của thợ ảnh. ID: ${response.data.id}`);
        return response.data.id;
    } catch (error) {
        console.error("Lỗi khi tạo thư mục gốc trên Drive của thợ ảnh:", error.message);
        throw error;
    }
};

/**
 * 7. Lấy danh sách file từ một thư mục (Dùng cho đồng bộ từ Drive vào DB)
 * @param {string} folderId ID thư mục trên Drive
 * @param {string} customRefreshToken Refresh Token riêng của thợ ảnh (nếu có)
 * @returns {Promise<Array>} Danh sách tệp tin
 */
exports.listFiles = async (folderId, customRefreshToken = null) => {
    const drive = getDriveClient(customRefreshToken);
    if (!drive || folderId.startsWith('mock_')) {
        console.log(`⚠️ Mock Mode: Giả lập lấy danh sách ảnh từ folder ID: ${folderId}`);
        return [
            {
                id: 'mock_file_1',
                name: 'album_cover.jpg',
                webViewLink: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=500'
            },
            {
                id: 'mock_file_2',
                name: 'wedding_kiss.jpg',
                webViewLink: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500'
            },
            {
                id: 'mock_file_3',
                name: 'party_dance.jpg',
                webViewLink: 'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=500'
            }
        ];
    }
    try {
        let allFiles = [];
        let pageToken = null;
        
        do {
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
                fields: 'nextPageToken, files(id, name, webViewLink)',
                pageSize: 1000,
                pageToken: pageToken
            });
            
            if (response.data.files && response.data.files.length > 0) {
                allFiles = allFiles.concat(response.data.files);
            }
            pageToken = response.data.nextPageToken;
        } while (pageToken);
        
        return allFiles;
    } catch (error) {
        console.error(`[Drive Service] Lỗi khi lấy danh sách file từ thư mục ${folderId}:`, error.message);
        throw error;
    }
};

/**
 * 8. Xóa file hoặc thư mục trên Drive
 * @param {string} fileId ID file hoặc thư mục cần xóa
 * @param {string} customRefreshToken Refresh Token riêng của thợ ảnh (nếu có)
 * @returns {Promise<boolean>} Kết quả xóa
 */
exports.deleteFromDrive = async (fileId, customRefreshToken = null) => {
    const drive = getDriveClient(customRefreshToken);
    if (!drive || fileId.startsWith('mock_')) {
        console.log(`⚠️ Mock Mode: Giả lập xóa file/folder ID: ${fileId}`);
        return true;
    }
    try {
        await drive.files.delete({ fileId });
        console.log(`[Drive Service] Đã xóa file/folder ID: ${fileId} thành công.`);
        return true;
    } catch (error) {
        console.error(`[Drive Service] Lỗi khi xóa file/folder ID ${fileId}:`, error.message);
        throw error;
    }
};

// Aliases để tương thích với các hàm cũ của Lộc
exports.uploadToDrive = async (fileBuffer, fileName, mimeType, targetFolderId) => {
    const res = await exports.uploadPhotoToFolder(fileBuffer, fileName, mimeType, targetFolderId);
    return res.webViewLink;
};
exports.createFolderOnDrive = async (folderName) => {
    return exports.createAlbumFolder(folderName);
};
