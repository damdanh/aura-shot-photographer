const jwt = require("jsonwebtoken");
const UserPackage = require("../models/UserPackage");

const protect = (req, res, next) => {
  try {
    // 1. Lấy token từ Header của request (định dạng: Bearer <token>)
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy token xác thực. Truy cập bị từ chối!",
      });
    }

    const token = authHeader.split(" ")[1];

    // 2. Giải mã và kiểm tra tính hợp lệ của token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Đính kèm thông tin user giải mã được vào request để các hàm sau sử dụng
    req.user = decoded; // decoded sẽ chứa { id, role }

    next(); // Cho phép đi tiếp vào Controller chính
  } catch (error) {
    res
      .status(401)
      .json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn!" });
  }
};

// Middleware phân quyền theo vai trò (Role)
protect.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện hành động này!",
      });
    }
    next();
  };
};

// Middleware kiểm tra gói dịch vụ SaaS đang hoạt động (chỉ áp dụng đối với Photographer)
protect.checkActiveSass = async (req, res, next) => {
  try {
    if (req.user && req.user.role === "photographer") {
      // [FIX] Thêm expired_at check để đồng bộ với albumController & productController
      // Tránh lỗ hổng: gói có status='active' nhưng đã quá ngày hết hạn vẫn được dùng
      let activeSub = await UserPackage.findOne({
        user_id: req.user.id,
        status: "active",
        expired_at: { $gt: new Date() },
      });

      // [FIX] Dự phòng cho tài khoản cũ: Nếu không có gói nào active, kiểm tra xem họ có package_id chưa
      // Nếu chưa có (null), tự động cấp phát gói Free để họ không bị kẹt
      if (!activeSub) {
        const User = require("../models/User");
        const user = await User.findById(req.user.id);

        if (user && !user.package_id) {
          const Package = require("../models/Package");
          const freePackage = await Package.findOne({ price: 0 });

          if (freePackage) {
            await User.findByIdAndUpdate(req.user.id, {
              package_id: freePackage._id,
            });
            activeSub = await UserPackage.create({
              package_id: freePackage._id,
              user_id: req.user.id,
              started_at: new Date(),
              expired_at: new Date(
                Date.now() +
                  (freePackage.duration_days || 30) * 24 * 60 * 60 * 1000,
              ),
              status: "active",
              price_paid: 0,
            });
          }
        }
      }

      if (!activeSub) {
        return res.status(403).json({
          success: false,
          message:
            "Gói dịch vụ của bạn đã hết hạn hoặc chưa được đăng ký! Vui lòng mua hoặc gia hạn gói SaaS để tiếp tục.",
        });
      }
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi kiểm tra gói dịch vụ: " + error.message,
    });
  }
};

// Middleware tùy chọn xác thực (nếu có Token thì giải mã, không có thì bỏ qua)
protect.optional = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch (error) {
    // Bỏ qua lỗi trong chế độ optional để tiếp tục request
  }
  next();
};

module.exports = protect;
