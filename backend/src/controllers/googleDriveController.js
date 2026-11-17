const { google } = require('googleapis');
const googleDriveService = require('../services/googleDriveService');
const User = require('../models/User');

/**
 * API sinh URL xác thực Google OAuth2 để thợ ảnh liên kết Drive
 * GET /api/auth/google-drive/connect
 */
exports.connectDrive = async (req, res) => {
    try {
        const userId = req.user.id; 
        const UserPackage = require('../models/UserPackage');
        
        // 1. Kiểm tra gói dịch vụ đang hoạt động
        const activeUserPackage = await UserPackage.findOne({ 
            user_id: userId, 
            status: 'active',
            expired_at: { $gt: new Date() }
        }).populate('package_id');

        if (!activeUserPackage) {
            return res.status(403).json({ 
                success: false, 
                message: "Bạn chưa đăng ký gói dịch vụ hoặc gói dịch vụ đã hết hạn! Vui lòng nâng cấp gói để sử dụng tính năng này." 
            });
        }

        const packageInfo = activeUserPackage.package_id;
        // Kiểm tra nếu là gói miễn phí (Free/Basic) thì không được dùng Drive cá nhân
        if (!packageInfo || packageInfo.price === 0 || packageInfo.name === 'Miễn phí') {
            return res.status(403).json({ 
                success: false, 
                message: "Gói dịch vụ hiện tại không hỗ trợ liên kết Google Drive cá nhân. Vui lòng nâng cấp lên gói Chuyên nghiệp hoặc Cao cấp!" 
            });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Sinh link yêu cầu cấp quyền Google Drive, kèm theo state là userId để nhận biết thợ ảnh ở Callback
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/drive.file'],
            state: userId
        });

        res.status(200).json({
            success: true,
            message: "Lấy đường dẫn xác thực Google thành công!",
            data: { url }
        });
    } catch (error) {
        console.error("Lỗi khi sinh URL xác thực Google:", error.message);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi khởi tạo OAuth Google Drive: " + error.message
        });
    }
};

/**
 * API xử lý Callback từ Google sau khi thợ ảnh cấp quyền
 * GET /api/auth/google-drive/callback (Public endpoint)
 */
exports.callbackDrive = async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.status(400).send("Không nhận được mã code xác thực từ Google.");
        }

        const userId = state; 
        if (!userId) {
            return res.status(400).send("Thiếu thông tin người dùng xác thực (state).");
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send("Người dùng không tồn tại trên hệ thống.");
        }

        // Đổi code lấy tokens
        const tokens = await googleDriveService.getTokensFromCode(code);
        if (!tokens.refresh_token) {
            return res.status(400).send(
                "Không nhận được Refresh Token từ Google. Có thể tài khoản của bạn đã được liên kết trước đó.<br/>" +
                "Vui lòng truy cập 'Tài khoản Google > Bảo mật > Quyền truy cập của bên thứ ba', hủy liên kết ứng dụng AuraShot và thử kết nối lại!"
            );
        }

        // Tạo thư mục gốc "AuraShot_Albums" trên Drive của thợ ảnh
        const rootFolderId = await googleDriveService.createRootFolderForPhotographer(tokens.refresh_token);

        // Lưu thông tin vào database của thợ ảnh
        user.googleDrive = {
            isConnected: true,
            refreshToken: tokens.refresh_token,
            rootFolderId: rootFolderId
        };
        await user.save();

        const frontendRedirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 100px; background-color: #f9f9f9; color: #333;">
                    <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                        <h2 style="color: #2e7d32; margin-top: 0;">🎉 Liên kết Google Drive thành công!</h2>
                        <p style="font-size: 16px; line-height: 1.6;">AuraShot đã kết nối và tạo thư mục <b>AuraShot_Albums</b> trên Drive của bạn.</p>
                        <p style="color: #666; font-size: 14px;">Trang web sẽ tự động quay lại thiết lập sau 3 giây...</p>
                    </div>
                    <script>
                        setTimeout(() => {
                            window.location.href = "${frontendRedirectUrl}/photographer/store?drive=success";
                        }, 3000);
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error("Lỗi OAuth Google callback:", error);
        res.status(500).send("Liên kết thất bại: " + error.message);
    }
};
