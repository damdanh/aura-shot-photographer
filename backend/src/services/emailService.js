const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendQuotaWarning = async (userEmail, fullName, usedStorageGb, maxStorageGb) => {
    try {
        const percent = Math.round((usedStorageGb / maxStorageGb) * 100);
        await resend.emails.send({
            from: 'Aura Shot <alerts@aurashot.click>', // Cần verify domain của bạn trên Resend
            to: userEmail,
            subject: '⚠️ CẢNH BÁO DUNG LƯỢNG LƯU TRỮ - AURA SHOT',
            html: `
                <h3>Chào ${fullName},</h3>
                <p>Chúng tôi phát hiện tài khoản của bạn đã sử dụng <strong>${percent}%</strong> dung lượng lưu trữ cho phép.</p>
                <ul>
                    <li>Dung lượng đã dùng: ${usedStorageGb.toFixed(2)} GB</li>
                    <li>Dung lượng tối đa gói: ${maxStorageGb} GB</li>
                </ul>
                <p>Vui lòng nâng cấp gói cước của bạn hoặc liên kết Google Drive cá nhân để không bị gián đoạn việc tải ảnh!</p>
                <br/>
                <p>Trân trọng,<br/>Đội ngũ Aura Shot</p>
            `
        });
        console.log(`✉️ Đã gửi cảnh báo dung lượng tới ${userEmail}`);
    } catch (error) {
        console.error("Lỗi gửi mail:", error.message);
    }
};
