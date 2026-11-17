const Product = require('../models/Product');
const PhotographerProfile = require('../models/PhotographerProfile');
const moderationService = require('../services/moderationService');
const OrderItem = require('../models/OrderItem');

// 1. Thợ ảnh thêm sản phẩm mới
exports.createProduct = async (req, res) => {
  try {
    const { name, type, price, image_url, is_featured, is_physical, description, gallery, stock, dimensions, material, return_policy } = req.body;
    if (!name || !type || price === undefined || !image_url) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin: Tên, loại, giá và ảnh sản phẩm!"
      });
    }
    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Giá sản phẩm phải là một số hợp lệ và không được âm!"
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

    const UserPackage = require('../models/UserPackage');

    // Bước 1: Lấy gói SaaS đang active của thợ ảnh, populate để lấy max_products
    const activeSub = await UserPackage.findOne({
      user_id: req.user.id,
      status: 'active',
      expired_at: { $gt: new Date() }
    }).populate('package_id');

    // Bước 2: Kiểm tra có gói đang active không
    if (!activeSub || !activeSub.package_id) {
      return res.status(403).json({
        success: false,
        message: "Bạn chưa đăng ký gói dịch vụ nào hoặc gói đã hết hạn! Vui lòng mua gói SaaS để tiếp tục."
      });
    }

    // Bước 3: Đếm tổng số sản phẩm và dịch vụ hiện có (không tính cái đã xóa mềm)
    const currentProductCount = await Product.countDocuments({
      user_id: req.user.id,
      status: { $ne: 'deleted' }
    });
    
    const Service = require('../models/Service');
    const currentServiceCount = await Service.countDocuments({
      user_id: req.user.id,
      status: { $ne: 'deleted' }
    });

    const totalListings = currentProductCount + currentServiceCount;

    // Bước 4: So sánh với giới hạn max_products của gói
    const maxProducts = activeSub.package_id.max_products;
    if (maxProducts !== -1 && totalListings >= maxProducts) {
      return res.status(403).json({
        success: false,
        message: `Gói dịch vụ hiện tại của bạn đã đạt giới hạn đăng tải (${maxProducts} Sản phẩm/Dịch vụ). Vui lòng nâng cấp gói!`
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    // Tự động kiểm duyệt văn bản khi tạo sản phẩm
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
      aiNote = `Tên hoặc thể loại sản phẩm chứa từ ngữ nhạy cảm vi phạm quy chuẩn: "${textMod.matchedWord}"`;
      suffixMsg = " (Sản phẩm bị tự động khóa do tên hoặc thể loại chứa từ ngữ nhạy cảm!)";
    }

    const newProduct = await Product.create({
      user_id: req.user.id,
      name,
      type,
      price: parsedPrice,
      image_url,
      is_active: isActive,
      is_featured: is_featured || false,
      is_physical: is_physical === true || is_physical === 'true',
      description: description || "",
      gallery: Array.isArray(gallery) ? gallery : (gallery ? [gallery] : []),
      stock: stock !== undefined ? Number(stock) : 100,
      dimensions: dimensions || "",
      material: material || "",
      return_policy: return_policy || "Đổi trả miễn phí trong vòng 7 ngày nếu sản phẩm có lỗi từ nhà sản xuất hoặc hư hỏng trong quá trình vận chuyển.",
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
        message: isBanned ? `Sản phẩm "${name}" chứa từ ngữ nhạy cảm.` : `Sản phẩm "${name}" đang chờ duyệt.`,
        target_url: '/admin/reports'
      });
    }

    if (isBanned) {
      return res.status(201).json({
        success: true,
        message: " Nội dung sản phẩm vi phạm tiêu chuẩn cộng đồng và đã bị khóa hiển thị!",
        data: newProduct
      });
    }

    res.status(201).json({
      success: true,
      message: ` Tạo sản phẩm thành công!${suffixMsg}`,
      data: newProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo sản phẩm: " + error.message
    });
  }
};

// 2. Cập nhật thông tin sản phẩm
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, price, image_url, is_featured, is_physical, description, gallery, stock, dimensions, material, return_policy } = req.body;
    const userId = req.user.id;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm này hoặc sản phẩm đã bị ẩn!"
      });
    }

    // Kiểm tra quyền sở hữu hoặc admin
    if (product.user_id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa sản phẩm này!"
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: "Tên sản phẩm không được để trống!" });
      }
      product.name = name;
    }
    if (type !== undefined) {
      if (!type.trim()) {
        return res.status(400).json({ success: false, message: "Thể loại sản phẩm không được để trống!" });
      }
      product.type = type;
    }
    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, message: "Giá sản phẩm phải là một số hợp lệ và không được âm!" });
      }
      product.price = parsedPrice;
    }
    if (image_url !== undefined) product.image_url = image_url;
    if (is_featured !== undefined) product.is_featured = is_featured;
    // [FIX] Cập nhật is_physical — hỗ trợ cả Boolean và String 'true'/'false'
    if (is_physical !== undefined) product.is_physical = is_physical === true || is_physical === 'true';
    if (description !== undefined) product.description = description;
    if (gallery !== undefined) product.gallery = Array.isArray(gallery) ? gallery : [gallery];
    if (stock !== undefined) product.stock = Number(stock);
    if (dimensions !== undefined) product.dimensions = dimensions;
    if (material !== undefined) product.material = material;
    if (return_policy !== undefined) product.return_policy = return_policy;

    // Kiểm duyệt lại sau khi chỉnh sửa
    const textMod = moderationService.checkText(product.name + " " + product.type);
    let suffixMsg = "";
    if (textMod.isViolated) {
      product.is_safe = false;
      product.ai_moderation_note = `Tên hoặc thể loại sản phẩm chứa từ ngữ nhạy cảm vi phạm quy chuẩn: "${textMod.matchedWord}"`;
      product.is_banned = true;
      product.status = 'banned';
      suffixMsg = " (Sản phẩm đã bị khóa do chứa từ ngữ nhạy cảm!)";
    } else {
      product.is_safe = true;
      product.ai_moderation_note = null;
      product.is_banned = false;
      product.status = 'active';
    }

    const updatedProduct = await product.save();

    res.status(200).json({
      success: true,
      message: `🎉 Cập nhật thông tin sản phẩm thành công!${suffixMsg}`,
      data: updatedProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật sản phẩm: " + error.message
    });
  }
};

// 3. Thợ ảnh ẩn/hiện sản phẩm (Không xóa cứng để giữ lịch sử hóa đơn)
exports.toggleProductActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user.id;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm!"
      });
    }

    // Kiểm tra quyền sở hữu
    if (product.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền ẩn/hiện sản phẩm này!"
      });
    }

    product.is_active = is_active !== undefined ? is_active : !product.is_active;
    await product.save();

    return res.status(200).json({
      success: true,
      message: product.is_active ? "Đã hiển thị lại sản phẩm!" : "Đã ẩn sản phẩm thành công!",
      data: product
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi ẩn/hiện sản phẩm: " + error.message
    });
  }
};

// 4. Thợ ảnh xóa mềm sản phẩm
exports.hideProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm này hoặc sản phẩm đã bị ẩn từ trước!"
      });
    }
    // Kiểm tra quyền sở hữu hoặc admin
    if (product.user_id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền ẩn sản phẩm của người khác!"
      });
    }
    await product.softDelete();

    res.status(200).json({
      success: true,
      message: `🎉 Đã ẩn sản phẩm "${product.name}" thành công (quy tắc cấm xóa cứng)!`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi ẩn sản phẩm: " + error.message
    });
  }
};

// 5. Thợ ảnh lấy danh sách sản phẩm cá nhân
exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ user_id: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách sản phẩm cá nhân: " + error.message
    });
  }
};

// 6. Lấy danh sách sản phẩm công khai
exports.getProducts = async (req, res) => {
  try {
    const { user_id, store_id, is_featured } = req.query;

    // Bộ lọc mặc định chỉ lấy sản phẩm đang hoạt động (không bị ẩn và không bị khóa)
    const filter = { is_active: true, is_banned: { $ne: true } };

    // Cho phép lọc theo thợ ảnh cụ thể (hỗ trợ cả param user_id hoặc store_id)
    const targetUserId = user_id || store_id;
    if (targetUserId) {
      filter.user_id = targetUserId;
    }

    // Lọc theo sản phẩm nổi bật
    if (is_featured !== undefined) {
      filter.is_featured = is_featured === 'true';
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách sản phẩm: " + error.message
    });
  }
};

// 7. Khóa Sản phẩm bởi Admin (Soft Ban)
exports.banProduct = async (req, res) => {
  try {
    const { id: product_id } = req.params;

    // Xác thực quyền Admin
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Chỉ tài khoản Admin mới có quyền khóa sản phẩm!"
      });
    }

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm này trên hệ thống!"
      });
    }

    product.is_banned = true;
    product.status = 'banned';
    await product.save();

    res.status(200).json({
      success: true,
      message: `🎉 Admin đã gỡ sản phẩm vi phạm "${product.name}" thành công!`,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khóa sản phẩm: " + error.message
    });
  }
};

// 8. Admin gỡ bỏ sản phẩm vi phạm (Xóa mềm thực sự bằng plugin softDelete)
exports.adminBanProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm hoặc sản phẩm đã bị gỡ trước đó!"
      });
    }

    // Thực hiện xóa mềm bằng plugin softDelete
    await product.softDelete();

    return res.status(200).json({
      success: true,
      message: "Admin đã gỡ bỏ sản phẩm vi phạm thành công!"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi gỡ bỏ sản phẩm: " + error.message
    });
  }
};
// 9. Lấy chi tiết 1 sản phẩm công khai theo ID (kèm thông tin thợ ảnh)
exports.getProductById = async(req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('user_id', 'full_name email avatar_url phone');
    if (!product || product.isDeleted || product.is_banned || !product.is_active) {
      return res.status(404).json({
        success: false, message: "Không tìm thấy sản phẩm hoặc sản phẩm này đã bị gỡ trước đó"
      });
    }
    return res.status(200).json({
      success: true, data: product
    });
  } catch (error) {
    return res.status(500).json({
      success: false, message: "Lỗi hệ thống khi lấy chi tiết sản phẩm: " + error.message
    });
  }
};

// 10. Lấy danh sách sản phẩm nổi bật
exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'active', is_banned: false, is_safe: true })
      .populate('user_id', 'full_name avatar_url');

    const productIds = products.map(p => p._id);

    // Tính toán số lượng đã bán hoặc doanh số
    const orderStats = await OrderItem.aggregate([
      { $match: { item_type: 'product', product_id: { $in: productIds } } },
      { $group: { _id: '$product_id', sales_volume: { $sum: '$quantity' }, revenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } } } }
    ]);
    const statsByProduct = new Map(orderStats.map(stat => [String(stat._id), stat]));

    let maxSalesVolume = 1;
    let maxRevenue = 1;
    statsByProduct.forEach(stat => { 
      if (stat.sales_volume > maxSalesVolume) maxSalesVolume = stat.sales_volume; 
      if (stat.revenue > maxRevenue) maxRevenue = stat.revenue;
    });

    const scoredProducts = products.map(product => {
      const value = product.toObject();
      const pId = String(product._id);
      
      const stats = statsByProduct.get(pId);
      const salesVolume = stats ? stats.sales_volume : 0;
      const revenue = stats ? stats.revenue : 0;
      
      // Độ mới: Tính trong vòng 30 ngày
      const isNew = (Date.now() - new Date(value.createdAt).getTime()) < (30 * 24 * 60 * 60 * 1000);
      const newBoost = isNew ? 100 : 0;

      const scoreSales = (salesVolume / maxSalesVolume) * 100;
      const scoreRevenue = (revenue / maxRevenue) * 100;

      // 50% Sales + 30% Revenue + 20% Freshness
      const totalScore = (scoreSales * 0.5) + (scoreRevenue * 0.3) + (newBoost * 0.2);
      
      value.sales_count = salesVolume;
      value.ranking_score = Math.round(totalScore * 100) / 100;
      return value;
    });

    const qualifiedProducts = scoredProducts.filter(p => p.sales_count >= 3);
    qualifiedProducts.sort((a, b) => b.ranking_score - a.ranking_score);
    const featuredProducts = qualifiedProducts.slice(0, 8);

    return res.status(200).json({
      success: true,
      count: featuredProducts.length,
      data: featuredProducts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách sản phẩm nổi bật: " + error.message
    });
  }
};