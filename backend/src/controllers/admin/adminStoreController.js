const User = require('../../models/User'); 
const PhotographerProfile = require('../../models/PhotographerProfile'); 

// GET /api/admin/stores -> Admin lấy toàn bộ danh sách gian hàng trên sàn
exports.getAllStores = async (req, res) => {
  try {
    const allProfiles = await PhotographerProfile.find()
      .populate({
        path: 'user_id',
        match: { role: 'photographer' }, 
        select: '-password'
      });

    // Loại bỏ những bản ghi rỗng (chỉ lấy tài khoản thợ chụp hợp lệ)
    const photographerStores = allProfiles.filter(profile => profile.user_id !== null);

    return res.status(200).json({ success: true, data: photographerStores });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
  }
};

// PATCH /api/admin/stores/:id/ban -> Admin khóa hoặc mở khóa tài khoản thợ chụp ảnh
exports.toggleBanStore = async (req, res) => {
  try {
    const store = await User.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng này!" });
    }

    store.is_banned = !store.is_banned;
    await store.save();

    return res.status(200).json({ 
      success: true, 
      message: store.is_banned ? "Đã khóa gian hàng thành công!" : "Đã mở khóa gian hàng thành công!" 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
  }
};
// PATCH /api/admin/albums/:id/ban -> Kiểm duyệt: Gỡ bỏ Album vi phạm nội dung
exports.adminToggleBanAlbum = async (req, res) => {
    try {
        const Album = require('../../models/Album');
        const album = await Album.findById(req.params.id);

        if (!album) return res.status(404).json({ success: false, message: "Không tìm thấy Album này trên hệ thống" });

        // Đảo trạng thái hoạt động / bị khóa dựa trên trường status của Album
        album.status = album.status === 'banned' ? 'active' : 'banned';
        album.is_banned = album.status === 'banned';
        await album.save();

        return res.status(200).json({ 
            success: true, 
            message: album.status === 'banned' ? "Đã khóa Album vi phạm nội dung thành công" : "Đã khôi phục hoạt động của Album" 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};