const Service = require('../models/Service');
const PhotographerProfile = require('../models/PhotographerProfile');
const moderationService = require('../services/moderationService');
const OrderItem = require('../models/OrderItem');

// 1. Thợ ảnh thêm dịch vụ mới
exports.createService = async (req, res) => {
  try {
    const { name, type, shooting_category, price, image_url, duration, is_featured, description, gallery, max_people, delivered_photos_count, delivery_time, location, package_includes, cancellation_policy, auto_delete_album_days } = req.body;
    if (!name || !type || price === undefined || !image_url) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin: Tên, loại, giá và ảnh dịch vụ!"
      });
    }

    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Giá dịch vụ phải là một số hợp lệ và không được âm!"
      });
    }

    // Kiểm tra xem thợ ảnh đã có gian hàng chưa
    const profile = await PhotographerProfile.findOne({ user_id: req.user.id });
    if (!profile) {
      return res.status(403).json({
        success: false,
        message: "Yêu cầu tạo gian hàng trước!"
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // KIỂM TRA GIỚI HẠN GÓI SAAS (Sản phẩm + Dịch vụ)
    // ─────────────────────────────────────────────────────────────────────
    const UserPackage = require('../models/UserPackage');
    const Product = require('../models/Product');

    const activeSub = await UserPackage.findOne({
      user_id: req.user.id,
      status: 'active',
      expired_at: { $gt: new Date() }
    }).populate('package_id');

    if (!activeSub || !activeSub.package_id) {
      return res.status(403).json({
        success: false,
        message: "Bạn chưa đăng ký gói dịch vụ nào hoặc gói đã hết hạn! Vui lòng mua gói SaaS để tiếp tục."
      });
    }

    const currentProductCount = await Product.countDocuments({
      user_id: req.user.id,
      status: { $ne: 'deleted' }
    });
    
    const currentServiceCount = await Service.countDocuments({
      user_id: req.user.id,
      status: { $ne: 'deleted' }
    });

    const totalListings = currentProductCount + currentServiceCount;
    const maxProducts = activeSub.package_id.max_products;

    if (maxProducts !== -1 && totalListings >= maxProducts) {
      return res.status(403).json({
        success: false,
        message: `Gói dịch vụ hiện tại của bạn đã đạt giới hạn đăng tải (${maxProducts} Sản phẩm/Dịch vụ). Vui lòng nâng cấp gói!`
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    // Tự động kiểm duyệt văn bản khi tạo dịch vụ
    const textMod = moderationService.checkText(name + " " + type);
    let isBanned = false;
    let statusVal = 'pending';
    let isSafe = true;
    let aiNote = null;
    let suffixMsg = " (Nội dung đang chờ Admin duyệt!)";
    let isActive = false;

    if (textMod.isViolated) {
      isSafe = false;
      isBanned = true;
      statusVal = 'banned';
      aiNote = `Tên hoặc loại dịch vụ chứa từ ngữ nhạy cảm vi phạm quy chuẩn: "${textMod.matchedWord}"`;
      suffixMsg = " (Dịch vụ bị tự động khóa do tên hoặc loại chứa từ ngữ nhạy cảm!)";
    }

    const newService = await Service.create({
      user_id: req.user.id,
      name,
      type,
      is_active: isActive,
      shooting_category: shooting_category || 'other',
      price: parsedPrice,
      image_url,
      duration: duration || null,
      is_featured: is_featured || false,
      description: description || "",
      gallery: Array.isArray(gallery) ? gallery : (gallery ? [gallery] : []),
      max_people: max_people !== undefined ? Number(max_people) : 2,
      delivered_photos_count: delivered_photos_count !== undefined ? Number(delivered_photos_count) : 30,
      delivery_time: delivery_time || "3-5 ngày sau khi chụp",
      location: location || "",
      package_includes: Array.isArray(package_includes) ? package_includes : (package_includes ? [package_includes] : []),
      cancellation_policy: cancellation_policy || "Hủy trước 3 ngày hoàn 100% tiền cọc, hủy trong vòng 3 ngày hoàn 50%.",
      auto_delete_album_days: auto_delete_album_days !== undefined ? (auto_delete_album_days === "" || auto_delete_album_days === null ? null : Number(auto_delete_album_days)) : null,
      is_banned: isBanned,
      status: statusVal,
      is_safe: isSafe,
      ai_moderation_note: aiNote
    });

    const User = require('../models/User');
    const Notification = require('../models/Notification');
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
    for (const admin of admins) {
      await Notification.create({
        user_id: admin._id,
        type: isBanned ? 'new_violation' : 'pending_content',
        title: isBanned ? 'Nội dung vi phạm' : 'Nội dung mới chờ duyệt',
        message: isBanned ? `Dịch vụ "${name}" chứa từ ngữ nhạy cảm.` : `Dịch vụ "${name}" đang chờ duyệt.`,
        target_url: '/admin/reports'
      });
    }

    if (isBanned) {
      return res.status(201).json({
        success: true,
        message: "Nội dung dịch vụ vi phạm tiêu chuẩn cộng đồng và đã bị khóa hiển thị!",
        data: newService
      });
    }

    res.status(201).json({
      success: true,
      message: `Tạo dịch vụ thành công!${suffixMsg}`,
      data: newService
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo dịch vụ: " + error.message
    });
  }
};

// 2. Cập nhật thông tin dịch vụ
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, shooting_category, price, image_url, duration, is_featured, description, gallery, max_people, delivered_photos_count, delivery_time, location, package_includes, cancellation_policy, auto_delete_album_days } = req.body;
    const userId = req.user.id;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ này hoặc dịch vụ đã bị ẩn!"
      });
    }

    // Kiểm tra quyền sở hữu hoặc admin
    if (service.user_id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa dịch vụ này!"
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: "Tên dịch vụ không được để trống!" });
      }
      service.name = name;
    }
    if (type !== undefined) {
      if (!type.trim()) {
        return res.status(400).json({ success: false, message: "Loại dịch vụ không được để trống!" });
      }
      service.type = type;
    }
    if (shooting_category !== undefined) service.shooting_category = shooting_category;
    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, message: "Giá dịch vụ phải là một số hợp lệ và không được âm!" });
      }
      service.price = parsedPrice;
    }
    if (image_url !== undefined) service.image_url = image_url;
    if (duration !== undefined) service.duration = duration;
    if (is_featured !== undefined) service.is_featured = is_featured;
    if (description !== undefined) service.description = description;
    if (gallery !== undefined) service.gallery = Array.isArray(gallery) ? gallery : [gallery];
    if (max_people !== undefined) service.max_people = Number(max_people);
    if (delivered_photos_count !== undefined) service.delivered_photos_count = Number(delivered_photos_count);
    if (delivery_time !== undefined) service.delivery_time = delivery_time;
    if (location !== undefined) service.location = location;
    if (package_includes !== undefined) service.package_includes = Array.isArray(package_includes) ? package_includes : [package_includes];
    if (cancellation_policy !== undefined) service.cancellation_policy = cancellation_policy;
    if (auto_delete_album_days !== undefined) {
      service.auto_delete_album_days = auto_delete_album_days === "" || auto_delete_album_days === null ? null : Number(auto_delete_album_days);
    }

    // Kiểm duyệt lại sau khi chỉnh sửa
    const textMod = moderationService.checkText(service.name + " " + service.type);
    let suffixMsg = "";
    if (textMod.isViolated) {
      service.is_safe = false;
      service.ai_moderation_note = `Tên hoặc loại dịch vụ chứa từ ngữ nhạy cảm vi phạm quy chuẩn: "${textMod.matchedWord}"`;
      service.is_banned = true;
      service.status = 'banned';
      service.is_active = false;
      suffixMsg = " (Dịch vụ đã bị khóa do chứa từ ngữ nhạy cảm!)";
    } else {
      service.is_safe = true;
      service.ai_moderation_note = null;
      service.is_banned = false;
      service.status = 'active';
    }

    const updatedService = await service.save();

    res.status(200).json({
      success: true,
      message: `🎉 Cập nhật thông tin dịch vụ thành công!${suffixMsg}`,
      data: updatedService
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật dịch vụ: " + error.message
    });
  }
};

// 3. Thợ ảnh ẩn/hiện dịch vụ
exports.toggleServiceActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user.id;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ!"
      });
    }

    // Kiểm tra quyền sở hữu
    if (service.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền ẩn/hiện dịch vụ này!"
      });
    }

    if (service.is_banned) {
      return res.status(403).json({
        success: false,
        message: "Dịch vụ này đã bị khóa do vi phạm tiêu chuẩn cộng đồng. Bạn không thể tự ý hiển thị lại!"
      });
    }

    service.is_active = is_active !== undefined ? is_active : !service.is_active;
    await service.save();

    return res.status(200).json({
      success: true,
      message: service.is_active ? "Đã hiển thị lại dịch vụ!" : "Đã ẩn dịch vụ thành công!",
      data: service
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi ẩn/hiện dịch vụ: " + error.message
    });
  }
};

// 4. Thợ ảnh xóa mềm dịch vụ
exports.hideService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ này hoặc dịch vụ đã bị ẩn từ trước!"
      });
    }
    // Kiểm tra quyền sở hữu hoặc admin
    if (service.user_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền ẩn dịch vụ của người khác!"
      });
    }
    await service.softDelete();

    res.status(200).json({
      success: true,
      message: `Đã ẩn dịch vụ "${service.name}" thành công (quy tắc cấm xóa cứng)!`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi ẩn dịch vụ: " + error.message
    });
  }
};

// 5. Thợ ảnh lấy danh sách dịch vụ cá nhân
exports.getMyServices = async (req, res) => {
  try {
    const services = await Service.find({ user_id: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách dịch vụ cá nhân: " + error.message
    });
  }
};

// 6. Lấy danh sách dịch vụ công khai
exports.getServices = async (req, res) => {
  try {
    const { user_id, store_id, is_featured } = req.query;

    // Bộ lọc mặc định chỉ lấy dịch vụ đang hoạt động (không bị ẩn và không bị khóa)
    const filter = { is_active: true, is_banned: { $ne: true } };

    // Cho phép lọc theo thợ ảnh cụ thể
    const targetUserId = user_id || store_id;
    if (targetUserId) {
      filter.user_id = targetUserId;
    }

    // Lọc theo dịch vụ nổi bật
    if (is_featured !== undefined) {
      filter.is_featured = is_featured === 'true';
    }

    const services = await Service.find(filter).populate('user_id', 'full_name email avatar_url phone').sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách dịch vụ: " + error.message
    });
  }
};

// 7. Khóa Dịch vụ bởi Admin (Soft Ban)
exports.banService = async (req, res) => {
  try {
    const { id } = req.params;

    // Xác thực quyền Admin
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Chỉ tài khoản Admin mới có quyền khóa dịch vụ!"
      });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ này trên hệ thống!"
      });
    }

    service.is_banned = true;
    service.status = 'banned';
    await service.save();

    res.status(200).json({
      success: true,
      message: `🎉 Admin đã gỡ dịch vụ vi phạm "${service.name}" thành công!`,
      data: service
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khóa dịch vụ: " + error.message
    });
  }
};
// 8. Lấy chi tiết 1 dịch vụ công khai theo ID (kèm thông tin thợ ảnh)
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id).populate('user_id', 'full_name email avatar_url phone');
    if (!service || service.isDeleted || service.is_banned || !service.is_active) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ này hoặc dịch vụ đã bị ẩn/khóa!"
      });
    }
    return res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy chi tiết dịch vụ: " + error.message
    });
  }
};

// 8. Lấy danh sách dịch vụ nổi bật
exports.getFeaturedServices = async (req, res) => {
  try {
    const services = await Service.find({ status: 'active', is_banned: false, is_safe: true })
      .populate('user_id', 'full_name avatar_url');

    const serviceIds = services.map(s => s._id);

    // Tính toán số lượt bán (Trending)
    const orderStats = await OrderItem.aggregate([
      { $match: { item_type: 'service', service_id: { $in: serviceIds } } },
      { $group: { _id: '$service_id', count: { $sum: 1 } } }
    ]);
    const salesByService = new Map(orderStats.map(stat => [String(stat._id), stat.count]));

    let maxSales = 1;
    salesByService.forEach(count => { if (count > maxSales) maxSales = count; });

    const scoredServices = services.map(service => {
      const value = service.toObject();
      const sId = String(service._id);
      
      const salesCount = salesByService.get(sId) || 0;
      
      let galleryScore = 0;
      if (value.gallery && value.gallery.length >= 3) galleryScore = 100;
      else if (value.gallery && value.gallery.length > 0) galleryScore = 50;

      const scoreSales = (salesCount / maxSales) * 100;

      // 70% Trending + 30% Quality/Gallery
      const totalScore = (scoreSales * 0.7) + (galleryScore * 0.3);
      
      value.sales_count = salesCount;
      value.ranking_score = Math.round(totalScore * 100) / 100;
      return value;
    });

    const qualifiedServices = scoredServices.filter(s => s.sales_count >= 3);
    qualifiedServices.sort((a, b) => b.ranking_score - a.ranking_score);
    const featuredServices = qualifiedServices.slice(0, 8);

    return res.status(200).json({
      success: true,
      count: featuredServices.length,
      data: featuredServices
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách dịch vụ nổi bật: " + error.message
    });
  }
};
