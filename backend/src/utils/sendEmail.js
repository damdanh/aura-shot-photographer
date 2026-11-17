//  # Hàm gửi mail OTP qua Nodemailer// backend/src/utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async ({ email, subject, text }) => {
  try {
    // 1. Cấu hình dịch vụ gửi Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // Sử dụng mật khẩu ứng dụng đã cấu hình
      }
    });

    // 2. Nội dung email gửi đi
    await transporter.sendMail({
      from: `"Aura Shot Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      text: text
    });

    console.log(`Email OTP đã được gửi thành công tới ${email}`);
  } catch (error) {
    console.error("Lỗi gửi email Nodemailer:", error);
    throw new Error("Không thể gửi email OTP. Vui lòng kiểm tra lại cấu hình Gmail.");
  }
};

module.exports = sendEmail;
