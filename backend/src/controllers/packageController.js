const Package = require('../models/Package');
const UserPackage = require('../models/UserPackage');
const User = require('../models/User');
const payos = require('../utils/payos');

const DEFAULT_PACKAGES = [
  { name: 'Miễn phí', max_albums: 5, max_products: 3, price: 0, duration_days: 0, storage_gb: 5, max_photos: 100, features: ['5 GB dung lượng', 'Tối đa 5 album', '100 ảnh', 'Hỗ trợ cơ bản'] },
  { name: 'Tiêu chuẩn', max_albums: 20, max_products: 15, price: 49000, duration_days: 30, storage_gb: 30, max_photos: 1000, features: ['30 GB dung lượng', 'Tối đa 20 album', '1.000 ảnh', 'Chia sẻ album', 'Hỗ trợ qua email'] },
  { name: 'Chuyên nghiệp', max_albums: 50, max_products: 30, price: 99000, duration_days: 30, storage_gb: 100, max_photos: 5000, features: ['100 GB dung lượng', 'Tối đa 50 album', '5.000 ảnh', 'Chia sẻ album', 'Tải ảnh chất lượng cao', 'Hỗ trợ ưu tiên'] },
  { name: 'Cao cấp', max_albums: -1, max_products: -1, price: 299000, duration_days: 30, storage_gb: -1, max_photos: -1, features: ['Dung lượng không giới hạn', 'Album không giới hạn', 'Ảnh không giới hạn', 'Chia sẻ album', 'Tải ảnh chất lượng cao', 'Hỗ trợ ưu tiên 24/7'] }
];

// 1. Lấy danh sách gói lưu trữ (Công khai)
exports.getPackages = async (req, res) => {
  try {
    if (await Package.countDocuments() === 0) await Package.insertMany(DEFAULT_PACKAGES);
    const packages = await Package.find({ is_active: { $ne: false } }).sort({ price: 1 });
    return res.status(200).json({
      success: true,
      count: packages.length,
      data: packages
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách gói dịch vụ: " + error.message
    });
  }
};

// 2. Admin tạo gói dịch vụ mới
exports.createPackage = async (req, res) => {
  try {
    const { name, max_albums, max_products, price, duration_days, storage_gb, max_photos, features, is_active } = req.body;

    if (!name || max_albums === undefined || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ Tên gói, số Album tối đa và Giá!"
      });
    }

    const newPackage = await Package.create({
      name,
      max_albums,
      max_products: max_products !== undefined ? max_products : 0,
      price, duration_days, storage_gb, max_photos,
      features: Array.isArray(features) ? features : [],
      is_active: is_active !== false
    });

    return res.status(201).json({
      success: true,
      message: "Tạo gói dịch vụ mới thành công!",
      data: newPackage
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo gói dịch vụ: " + error.message
    });
  }
};

// 3. Admin cập nhật gói dịch vụ
exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, max_albums, max_products, price, duration_days, storage_gb, max_photos, features, is_active } = req.body;

    const pkg = await Package.findById(id);
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gói dịch vụ!"
      });
    }

    if (name) pkg.name = name;
    if (max_albums !== undefined) pkg.max_albums = max_albums;
    if (max_products !== undefined) pkg.max_products = max_products;
    if (price !== undefined) pkg.price = price;
    if (duration_days !== undefined) pkg.duration_days = duration_days;
    if (storage_gb !== undefined) pkg.storage_gb = storage_gb;
    if (max_photos !== undefined) pkg.max_photos = max_photos;
    if (Array.isArray(features)) pkg.features = features;
    if (is_active !== undefined) pkg.is_active = is_active;

    await pkg.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật gói dịch vụ thành công!",
      data: pkg
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật gói dịch vụ: " + error.message
    });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(req.params.id, { is_active: false }, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Không tìm thấy gói dịch vụ!' });
    return res.json({ success: true, message: 'Đã ẩn gói dịch vụ.', data: pkg });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể ẩn gói dịch vụ: ' + error.message });
  }
};

// Admin duyệt gói dịch vụ (Chuyển trạng thái pending_payment -> active)
exports.approveSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await UserPackage.findById(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu đăng ký này!" });
    }
    if (subscription.status !== 'pending_payment') {
      return res.status(400).json({ success: false, message: "Gói này không ở trạng thái chờ thanh toán!" });
    }

    // Cập nhật trạng thái subscription
    subscription.status = 'active';
    await subscription.save();

    // Hủy các gói active cũ của thợ ảnh này
    await UserPackage.updateMany(
      { user_id: subscription.user_id, status: 'active', _id: { $ne: subscriptionId } },
      { $set: { status: 'cancelled' } }
    );

    // Cập nhật package_id cho User
    await User.findByIdAndUpdate(subscription.user_id, { package_id: subscription.package_id });

    return res.status(200).json({
      success: true,
      message: "Đã duyệt và kích hoạt gói thành công!",
      data: subscription
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi duyệt gói: " + error.message });
  }
};

// 4. Thợ ảnh mua/gia hạn gói dịch vụ
exports.subscribePackage = async (req, res) => {
  try {
    const { packageId } = req.body || {};
    const userId = req.user.id;


    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã packageId!"
      });
    }

    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gói lưu trữ này trên hệ thống!"
      });
    }

    // Vì đã bỏ tính năng Wallet (mô hình P2P), việc thanh toán gói SaaS (nếu có phí) sẽ được xử lý qua phương thức khác (VD: chuyển khoản thủ công hoặc ghi nợ). 
    // Tạm thời bỏ qua bước trừ tiền trong ví ảo.

    const isFree = pkg.price === 0;
    const subscriptionStatus = isFree ? 'active' : 'pending_payment';

    let orderCode = null;
    let checkoutUrl = null;

    if (isFree) {
      // Tắt các gói cũ đang hoạt động của thợ chụp ảnh này
      await UserPackage.updateMany(
        { user_id: userId, status: 'active' },
        { $set: { status: 'cancelled' } }
      );
      await User.findByIdAndUpdate(userId, { package_id: packageId });
    } else {
      // Hủy các yêu cầu mua gói đang chờ thanh toán trước đó
      await UserPackage.updateMany(
        { user_id: userId, status: 'pending_payment' },
        { $set: { status: 'cancelled' } }
      );
      
      // Tạo mã thanh toán với PayOS nếu có cấu hình
      orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000));
      if (payos.isConfigured && payos.isConfigured()) {
        try {
          const paymentData = {
              orderCode: orderCode,
              amount: pkg.price,
              description: `Mua goi ${pkg.name.substring(0, 15)}`,
              cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/photographer/subscription`,
              returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/photographer/subscription?success=true`
          };
          const paymentLinkRes = await payos.createPaymentLink(paymentData);
          checkoutUrl = paymentLinkRes.checkoutUrl;
        } catch (payosError) {
          console.error("Lỗi tạo PayOS link:", payosError);
        }
      }
    }

    // Thời gian đăng ký mặc định là 30 ngày kể từ lúc mua
    const started_at = new Date();
    const expired_at = new Date();
    expired_at.setDate(started_at.getDate() + (pkg.duration_days || 30));

    const subscription = await UserPackage.create({
      package_id: packageId,
      user_id: userId,
      started_at,
      expired_at,
      status: subscriptionStatus,
      price_paid: pkg.price,
      order_code: orderCode
    });

    const populatedSubscription = await UserPackage.findById(subscription._id).populate('package_id');

    return res.status(201).json({
      success: true,
      message: isFree 
        ? `Đăng ký gói lưu trữ "${pkg.name}" thành công! Có hiệu lực đến ${expired_at.toLocaleDateString('vi-VN')}`
        : `Đã tạo yêu cầu mua gói "${pkg.name}". Vui lòng thanh toán qua mã QR để kích hoạt.`,
      checkoutUrl: checkoutUrl,
      data: populatedSubscription
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi đăng ký gói: " + error.message
    });
  }
};

// Webhook xử lý thanh toán từ PayOS
exports.payosWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Nếu có PAYOS_CHECKSUM_KEY, tiến hành verify webhook
    if (payos.isConfigured && payos.isConfigured()) {
      try {
        const isValid = payos.verifyPaymentWebhookData(webhookData);
        if (!isValid) return res.status(400).json({ success: false, message: "Webhook không hợp lệ" });
      } catch (err) {
        return res.status(400).json({ success: false, message: "Lỗi xác thực webhook: " + err.message });
      }
    }

    const { orderCode, amount, code } = webhookData.data || webhookData;

    if (code === "00") { // Mã 00 thường là thanh toán thành công trong PayOS
      const subscription = await UserPackage.findOne({ order_code: orderCode, status: 'pending_payment' });
      
      if (subscription && subscription.price_paid <= amount) {
        // Duyệt gói
        subscription.status = 'active';
        await subscription.save();

        // Hủy các gói active cũ của thợ ảnh này
        await UserPackage.updateMany(
          { user_id: subscription.user_id, status: 'active', _id: { $ne: subscription._id } },
          { $set: { status: 'cancelled' } }
        );

        // Cập nhật package_id cho User
        await User.findByIdAndUpdate(subscription.user_id, { package_id: subscription.package_id });
      }
    }

    return res.status(200).json({ success: true, message: "Webhook received" });
  } catch (error) {
    console.error("Lỗi xử lý webhook PayOS:", error);
    return res.status(500).json({ success: false, message: "Lỗi xử lý webhook" });
  }
};

// 5. Lấy gói dịch vụ hiện tại của thợ ảnh
exports.getMySubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Nếu có yêu cầu hủy đơn chờ thanh toán
    if (req.query.cancel_pending === 'true') {
      await UserPackage.updateMany(
        { user_id: userId, status: 'pending_payment' },
        { $set: { status: 'cancelled' } }
      );
    }

    // Tìm gói đang active gần nhất
    let subscription = await UserPackage.findOne({ 
      user_id: userId, 
      status: 'active',
      expired_at: { $gt: new Date() }
    }).sort({ createdAt: -1 }).populate('package_id');

    // Kiểm tra đơn đang chờ thanh toán
    const pendingSubscription = await UserPackage.findOne({
      user_id: userId,
      status: 'pending_payment'
    }).sort({ createdAt: -1 }).populate('package_id');

    // Nếu vẫn chưa có subscription active nào, kiểm tra package_id trong User model hoặc gán Free
    if (!subscription) {
      const user = await User.findById(userId).populate('package_id');
      if (user && user.package_id) {
        const pkgId = user.package_id._id || user.package_id;
        subscription = await UserPackage.create({
          package_id: pkgId,
          user_id: userId,
          started_at: new Date(),
          expired_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'active',
          price_paid: user.package_id.price || 0
        });
        subscription = await UserPackage.findById(subscription._id).populate('package_id');
      } else {
        // Fallback: Tự động tìm gói Free và gán nếu user.package_id bị null (dành cho tk cũ)
        const Package = require('../models/Package');
        const freePackage = await Package.findOne({ price: 0 });
        if (freePackage) {
          await User.findByIdAndUpdate(userId, { package_id: freePackage._id });
          subscription = await UserPackage.create({
            package_id: freePackage._id,
            user_id: userId,
            started_at: new Date(),
            expired_at: new Date(Date.now() + (freePackage.duration_days || 30) * 24 * 60 * 60 * 1000),
            status: 'active',
            price_paid: 0
          });
          subscription = await UserPackage.findById(subscription._id).populate('package_id');
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: subscription,
      pending: pendingSubscription
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy thông tin gói: " + error.message
    });
  }
};

// 6. Admin lấy toàn bộ danh sách gói đã mua
exports.getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await UserPackage.find()
      .populate('user_id', 'full_name email phone')
      .populate('package_id', 'name price')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách đăng ký: " + error.message
    });
  }
};
