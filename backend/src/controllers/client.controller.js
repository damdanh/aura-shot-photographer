const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * 1. Hàm createClientAccount(req, res)
 * - Nhận username (tương ứng với email), password, full_name, phone từ req.body.
 * - Validate: Không được bỏ trống username/password. Password >= 6 ký tự. Kiểm tra username trùng lặp trong DB.
 * - Xử lý băm mật khẩu (bcrypt.hash) trước khi lưu.
 * - Logic chốt chặn: Khi User.create(), BẮT BUỘC gán cứng trường role: 'client' và trường created_by: req.user.id.
 * - Trả về dữ liệu user vừa tạo nhưng loại bỏ trường password.
 */
exports.createClientAccount = async (req, res) => {
  try {
    const { username, password, full_name, phone } = req.body;
    const photographerId = req.user.id; // Lấy từ middleware xác thực

    // Validate
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Không được bỏ trống tài khoản (username) và mật khẩu (password)."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải từ 6 ký tự trở lên."
      });
    }

    // Kiểm tra trùng lặp email/username (trong schema hiện tại email được dùng làm username)
    const existingUser = await User.findOne({ email: username.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Tên tài khoản (username/email) này đã tồn tại trên hệ thống!"
      });
    }

    // Xử lý băm mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // BẮT BUỘC gán cứng role: 'customer' và photographer_id: photographerId
    const newClient = await User.create({
      email: username.toLowerCase().trim(),
      password: hashedPassword,
      full_name: full_name || username,
      phone: phone || null,
      role: 'customer',
      photographer_id: photographerId
    });

    // Tạo giỏ hàng trống cho khách hàng mới để giữ tính tương thích với hệ thống
    try {
      const Cart = require('../models/Cart');
      if (Cart) {
        await Cart.create({
          user_id: newClient._id,
          items: []
        });
      }
    } catch (cartError) {
      console.warn("⚠️ Không thể tạo giỏ hàng cho khách hàng mới:", cartError.message);
    }

    // Trả về dữ liệu và loại bỏ trường password
    const clientData = newClient.toObject();
    delete clientData.password;

    return res.status(201).json({
      success: true,
      message: "Tạo tài khoản khách hàng thành công!",
      data: clientData
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo tài khoản khách hàng: " + error.message,
      data: null
    });
  }
};

/**
 * 2. Hàm getMyClients(req, res)
 * - Lấy danh sách khách hàng của riêng thợ ảnh đó.
 * - Điều kiện truy vấn: { role: 'client', created_by: req.user.id }
 * - Logic chốt chặn: Sử dụng .select('-password') để bảo mật.
 * - Áp dụng phân trang (Pagination) với page và limit lấy từ req.query.
 * - Sắp xếp theo thời gian mới nhất (createdAt: -1).
 */
exports.getMyClients = async (req, res) => {
  try {
    const photographerId = req.user.id;
    let { page, limit } = req.query;

    // Cấu hình phân trang mặc định
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Điều kiện lọc chốt chặn
    const filter = {
      role: 'customer',
      photographer_id: photographerId
    };

    // Truy vấn kết hợp loại bỏ mật khẩu, phân trang, và sắp xếp mới nhất
    const clients = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalClients = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalClients / limit);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách khách hàng thành công!",
      data: {
        clients,
        pagination: {
          total_clients: totalClients,
          current_page: page,
          total_pages: totalPages,
          limit
        }
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách khách hàng: " + error.message,
      data: null
    });
  }
};
