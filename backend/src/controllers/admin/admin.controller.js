const Product = require('../../models/Product');
const Service = require('../../models/Service');
const Album = require('../../models/Album');
const Photo = require('../../models/Photo');

/**
 * 3. Hàm getViolations(req, res)
 * - Lấy danh sách nội dung bị AI khóa (is_safe: false).
 * - Logic chốt chặn: Sử dụng Promise.all để query đồng thời 4 Collection (Products, Services, Albums, Photos) có điều kiện { is_safe: false }.
 * - Map qua từng mảng kết quả để thêm một trường ảo type (gán lần lượt là 'product', 'service', 'album', 'photo').
 * - Gộp (flatten) 4 mảng lại thành 1 mảng duy nhất, sort bằng JavaScript theo createdAt mới nhất và trả về.
 */
exports.getViolations = async (req, res) => {
  try {
    // Truy vấn đồng thời các Collection bằng Promise.all với bộ lọc is_safe: false
    const [products, services, albums, photos] = await Promise.all([
      Product.find({ is_safe: false }).populate('user_id', 'full_name email'),
      Service.find({ is_safe: false }).populate('user_id', 'full_name email'),
      Album.find({ is_safe: false }).populate('user_id', 'full_name email'),
      Photo.find({ is_safe: false }).populate({
        path: 'album_id',
        populate: { path: 'user_id', select: 'full_name email' }
      })
    ]);

    // Thêm trường ảo 'type' vào từng mảng kết quả
    const mappedProducts = products.map(item => {
      const obj = item.toObject();
      obj.type = 'product';
      return obj;
    });

    const mappedServices = services.map(item => {
      const obj = item.toObject();
      obj.type = 'service';
      return obj;
    });

    const mappedAlbums = albums.map(item => {
      const obj = item.toObject();
      obj.type = 'album';
      return obj;
    });

    const mappedPhotos = photos.map(item => {
      const obj = item.toObject();
      obj.type = 'photo';
      return obj;
    });

    // Gộp (flatten) các mảng lại thành 1 mảng duy nhất
    const allViolations = [...mappedProducts, ...mappedServices, ...mappedAlbums, ...mappedPhotos];

    // Sắp xếp bằng JavaScript theo thời gian tạo (createdAt) mới nhất
    allViolations.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách nội dung vi phạm thành công!",
      data: allViolations
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách nội dung vi phạm: " + error.message,
      data: null
    });
  }
};

/**
 * 4. Hàm restoreViolation(req, res)
 * - Nhận id từ req.params và type từ req.body (hoặc req.query).
 * - Logic chốt chặn: Dùng switch(type) hoặc if...else để trỏ đúng vào Model (Product hoặc Service hoặc Album hoặc Photo).
 * - Dùng findByIdAndUpdate để cập nhật bản ghi: Đổi is_safe: true, set ai_moderation_note: null, và thêm trường restored_by: req.user.id.
 * - Trả về message thông báo khôi phục thành công.
 */
exports.restoreViolation = async (req, res) => {
  try {
    const { id } = req.params;
    // Nhận type từ req.body, nếu không có thì thử lấy từ req.query làm dự phòng
    const type = req.body.type || req.query.type;
    const adminId = req.user.id; // Lấy từ token của Admin đã đăng nhập

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp loại nội dung (type: 'product', 'service', 'album', 'photo') trong req.body hoặc req.query."
      });
    }

    // Xác định Model dựa trên trường type bằng switch case
    let TargetModel;
    switch (type.toLowerCase().trim()) {
      case 'product':
        TargetModel = Product;
        break;
      case 'service':
        TargetModel = Service;
        break;
      case 'album':
        TargetModel = Album;
        break;
      case 'photo':
        TargetModel = Photo;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Loại nội dung 'type' không hợp lệ! Chỉ chấp nhận: 'product', 'service', 'album', 'photo'."
        });
    }

    // Tiến hành cập nhật bản ghi bị vi phạm
    let updateFields = {
      is_safe: true,
      ai_moderation_note: null, // Làm rỗng ghi chú vi phạm
      restored_by: adminId,     // Lưu vết Admin khôi phục nội dung
      is_banned: false
    };

    if (TargetModel === Product || TargetModel === Service || TargetModel === Album) {
      updateFields.status = 'active';
    }
    
    if (TargetModel === Product || TargetModel === Service) {
      updateFields.is_active = true;
    }

    const updatedRecord = await TargetModel.findByIdAndUpdate(
      id,
      updateFields,
      { new: true } // Trả về dữ liệu mới sau cập nhật
    );

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy nội dung có ID ${id} thuộc loại '${type}' để khôi phục!`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Khôi phục nội dung loại '${type}' thành công!`,
      data: updatedRecord
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khôi phục nội dung: " + error.message,
      data: null
    });
  }
};

/**
 * 5. Lấy danh sách nội dung đang chờ duyệt (Pending)
 * Chỉ áp dụng cho Product và Service
 */
exports.getPendingContents = async (req, res) => {
  try {
    const [products, services] = await Promise.all([
      Product.find({ status: 'pending' }).populate('user_id', 'full_name email'),
      Service.find({ status: 'pending' }).populate('user_id', 'full_name email')
    ]);

    const mappedProducts = products.map(item => ({ ...item.toObject(), type: 'product' }));
    const mappedServices = services.map(item => ({ ...item.toObject(), type: 'service' }));

    const allPending = [...mappedProducts, ...mappedServices];
    allPending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách chờ duyệt thành công!",
      data: allPending
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách chờ duyệt: " + error.message,
      data: null
    });
  }
};

/**
 * 6. Duyệt nội dung
 */
exports.approveContent = async (req, res) => {
  try {
    const { id } = req.params;
    const type = req.body.type || req.query.type;

    if (!type || !['product', 'service'].includes(type.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Type không hợp lệ! (product/service)" });
    }

    const TargetModel = type.toLowerCase() === 'product' ? Product : Service;
    const record = await TargetModel.findById(id);

    if (!record) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nội dung!" });
    }

    record.status = 'active';
    record.is_active = true;
    record.is_banned = false;
    record.is_safe = true;
    await record.save();

    return res.status(200).json({
      success: true,
      message: "Duyệt nội dung thành công!",
      data: record
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi duyệt nội dung: " + error.message
    });
  }
};

/**
 * 7. Từ chối nội dung
 */
exports.rejectContent = async (req, res) => {
  try {
    const { id } = req.params;
    const type = req.body.type || req.query.type;
    const adminId = req.user.id;
    const { reason } = req.body;

    if (!type || !['product', 'service'].includes(type.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Type không hợp lệ! (product/service)" });
    }

    const TargetModel = type.toLowerCase() === 'product' ? Product : Service;
    const record = await TargetModel.findById(id);

    if (!record) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nội dung!" });
    }

    record.status = 'banned';
    record.is_banned = true;
    record.ai_moderation_note = reason ? `Bị từ chối bởi Admin: ${reason}` : "Bị từ chối bởi Admin";
    await record.save();

    return res.status(200).json({
      success: true,
      message: "Đã từ chối nội dung!",
      data: record
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi từ chối nội dung: " + error.message
    });
  }
};
