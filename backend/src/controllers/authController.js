// backend/src/controllers/authController.js
const User = require('../models/User');
const Otp = require('../models/Otp');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PhotographerProfile = require('../models/PhotographerProfile');
const Cart = require('../models/Cart');

// 1. Đăng ký tài khoản (Register)
exports.register = async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ họ tên, Email và Mật khẩu!" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu đăng ký phải từ 6 ký tự trở lên để đảm bảo an toàn!" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email này đã được đăng ký tài khoản khác!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      email,
      password: hashedPassword,
      full_name,
      role: role || 'photographer'
    });

    await Cart.create({
      user_id: newUser._id,
      items: []
    });

    // Nếu là nhiếp ảnh gia thì khởi tạo trang Hồ sơ cá nhân
    if (newUser.role === 'photographer') {
      await PhotographerProfile.create({
        user_id: newUser._id,
        bio: `Xin chào, tôi là ${full_name}. Chào mừng đến với không gian nhiếp ảnh của tôi!`,
        skills: []
      });

      // Tự động cấp phát Gói Dịch vụ Miễn Phí
      const Package = require('../models/Package');
      const UserPackage = require('../models/UserPackage');
      const freePackage = await Package.findOne({ price: 0 });

      if (freePackage) {
        await User.findByIdAndUpdate(newUser._id, { package_id: freePackage._id });
        
        const started_at = new Date();
        const expired_at = new Date();
        // Thời hạn mặc định 30 ngày (hoặc theo cấu hình gói)
        expired_at.setDate(started_at.getDate() + (freePackage.duration_days || 30));

        await UserPackage.create({
          package_id: freePackage._id,
          user_id: newUser._id,
          started_at,
          expired_at,
          status: 'active',
          price_paid: 0
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản và thiết lập hệ thống thành công!",
      data: { 
        id: newUser._id, 
        full_name: newUser.full_name, 
        email: newUser.email, 
        role: newUser.role 
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
  }
};

// 2. Đăng nhập (Login)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ cả Email và Mật khẩu!" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Tài khoản hoặc mật khẩu không chính xác!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Tài khoản hoặc mật khẩu không chính xác!" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );
    
    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      token,
      user: { 
        id: user._id, 
        full_name: user.full_name,
        email: user.email, 
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
  }
};

// 3. Gửi mã OTP Quên mật khẩu
exports.sendOtpForgot = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập Email để nhận mã xác thực OTP!" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email không tồn tại trong hệ thống!" });
    }
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.deleteMany({ email });
    await Otp.create({ email, otp: otpCode });

    await sendEmail({
      email,
      subject: "[Aura Shot] Mã OTP Khôi Phục Mật Khẩu",
      text: `Chào bạn,\n\nMã xác thực OTP của bạn là: ${otpCode}.\nMã này có thời hạn sử dụng là đúng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai!\n\nThân ái,\nĐội ngũ hỗ trợ Aura Shot.`
    });
    res.status(200).json({
      success: true,
      message: "Mã xác thực OTP đã được gửi đến Gmail của bạn. Vui lòng kiểm tra hộp thư!"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gặp lỗi khi gửi OTP: " + error.message });
  }
};

// 4. Xác thực OTP và Đặt lại mật khẩu mới
exports.verifyOtpAndResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Email, mã OTP và Mật khẩu mới!" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải từ 6 ký tự trở lên để đảm bảo bảo mật!" });
    }

    const otpRecord = await Otp.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không chính xác hoặc đã hết hạn (quá 5 phút)!"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);
    await User.updateOne({ _id: user._id }, { password: hashedNewPassword });
    await Otp.deleteMany({ email });

    res.status(200).json({
      success: true,
      message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi đặt lại mật khẩu: " + error.message });
  }
};

exports.createClient = async (req, res) => {
  try {
    const {email, password, full_name, phone } = req.body;
    const photographerId = req.user.id; 
    if(!email || !password || !full_name) {
      return res.status(400).json({success: false, message: "Vui lòng nhập đầy đủ họ tên, Email và Mật khẩu"})
    }
    const existingUser = await User.findOne({email})
    if(existingUser) {
      return res.status(400).json({success: false, message: "Email này đã tồn tại trong hệ thống"})
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newCustomer = await User.create({
      email,
      password: hashedPassword,
      full_name,
      role: 'customer',
      phone: phone || null,
      photographer_id: photographerId
    });

    await Cart.create({
      user_id: newCustomer._id,
      items: []
    });
    
    return res.status(200).json({success: true, message: "Tạo tài khoản khách hàng thành công",
     data: {
      id: newCustomer._id,
      full_name: newCustomer.full_name,
      email: newCustomer.email,
      role: newCustomer.role,
      photographer_id: newCustomer.photographer_id,
      }
    });
  } catch (error) {
    res.status(500).json({success: false, message: "Lỗi hệ thống: " + error.message});
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('package_id');
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    // Tự động đồng bộ và tính dung lượng lưu trữ thực tế từ tất cả ảnh trong Album của thợ ảnh
    let photosCount = 0;
    if (user.role === 'photographer') {
      const Album = require('../models/Album');
      const Photo = require('../models/Photo');
      const userAlbums = await Album.find({ user_id: user._id }).select('_id');
      const albumIds = userAlbums.map(a => a._id);
      
      let actualBytes = 0;
      if (albumIds.length > 0) {
        photosCount = await Photo.countDocuments({ album_id: { $in: albumIds } });
        // Bước 1: Tính tổng file_size hiện tại trong DB
        const photoAggregation = await Photo.aggregate([
          { $match: { album_id: { $in: albumIds } } },
          { $group: { _id: null, totalSize: { $sum: "$file_size" } } }
        ]);
        actualBytes = photoAggregation.length > 0 ? (photoAggregation[0].totalSize || 0) : 0;

        // Bước 2: Nếu tổng = 0 nhưng có ảnh → ảnh cũ chưa ghi file_size → quét VPS lấy dung lượng thực
        if (actualBytes === 0 && photosCount > 0) {
          const photosNeedFix = await Photo.find({
            album_id: { $in: albumIds },
            drive_file_id: { $ne: null },
            $or: [{ file_size: 0 }, { file_size: null }, { file_size: { $exists: false } }]
          }).select('_id drive_file_id');

          if (photosNeedFix.length > 0) {
            try {
              const Client = require('ssh2-sftp-client');
              const sftp = new Client();
              await sftp.connect({
                host: process.env.VPS_HOST,
                port: process.env.VPS_PORT || 22,
                username: process.env.VPS_USER,
                password: process.env.VPS_PASSWORD
              });
              const uploadDir = '/var/www/aura-shot/uploads';

              for (const photo of photosNeedFix) {
                try {
                  const remotePath = `${uploadDir}/${photo.drive_file_id}`;
                  const stat = await sftp.stat(remotePath);
                  if (stat && stat.size > 0) {
                    await Photo.findByIdAndUpdate(photo._id, { file_size: stat.size });
                    actualBytes += stat.size;
                  }
                } catch (_) { /* File không tồn tại trên VPS, bỏ qua */ }
              }
              sftp.end();
              console.log(`📦 Auto-fix file_size: Đã cập nhật ${photosNeedFix.length} ảnh cho photographer ${user.email}`);
            } catch (sftpErr) {
              console.error('⚠️ Không thể kết nối VPS để auto-fix file_size:', sftpErr.message);
            }
          }
        }
      }
      if (user.used_storage_bytes !== actualBytes) {
        user.used_storage_bytes = actualBytes;
        await User.findByIdAndUpdate(user._id, { used_storage_bytes: actualBytes });
      }
    }

    const userData = user.toObject();
    userData.photos_count = photosCount;

    res.status(200).json({ success: true, data: userData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const { full_name, phone } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    if (full_name !== undefined) user.full_name = full_name;
    if (phone !== undefined) user.phone = phone;

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin cá nhân thành công!",
      data: updatedUser
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật thông tin cá nhân: " + error.message });
  }
};

// 1b. Photographer tự cấp phát tài khoản định danh cho Khách hàng (Client)
exports.createClientByPhotographer = async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    const photographerId = req.user.id;

    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Họ tên, Email/Username và Mật khẩu!" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu khách hàng phải từ 6 ký tự trở lên!" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email hoặc tên tài khoản này đã tồn tại trên hệ thống!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newClient = await User.create({
      email,
      password: hashedPassword,
      full_name,
      phone: phone || null,
      role: 'customer',
      photographer_id: photographerId
    });

    // Tạo giỏ hàng trống cho khách hàng mới
    await Cart.create({
      user_id: newClient._id,
      items: []
    });

    res.status(201).json({
      success: true,
      message: "Tạo tài khoản Khách hàng thành công!",
      data: {
        id: newClient._id,
        full_name: newClient.full_name,
        email: newClient.email,
        role: newClient.role,
        photographer_id: newClient.photographer_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi tạo tài khoản khách hàng: " + error.message });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Vui lòng chọn một ảnh đại diện hợp lệ." });
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatar_url: avatarUrl } },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
    return res.status(200).json({ success: true, message: "Cập nhật ảnh đại diện thành công!", data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể cập nhật ảnh đại diện: " + error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    const userId = req.user.id;

    if (!old_password || !new_password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập mật khẩu cũ và mật khẩu mới!" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải từ 6 ký tự trở lên!" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại!" });
    }

    const isMatch = await bcrypt.compare(old_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Mật khẩu cũ không chính xác!" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(new_password, salt);
    await user.save();

    res.status(200).json({ success: true, message: "Đổi mật khẩu thành công!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi đổi mật khẩu: " + error.message });
  }
};
