const Notification = require('../models/Notification');

//1// 1. GET /api/notifications -> Lấy danh sách thông báo của User hiện tại (sắp xếp mới nhất lên đầu)
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user_id: req.user.id })
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách thông báo: " + error.message
        });
    }
};
// 2. PUT /api/notifications/:id/read -> Đánh dấu 1 thông báo là đã đọc
exports.markAsRead = async (req, res) => {
    try{
        const notification = await Notification.findOneAndUpdate(
            {_id: req.params.id, user_id: req.user.id},
            {$set: {is_read: true}},
            {new: true}
        );
        if(!notification){
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy thông báo hoặc bạn không có quyền sở hữu thông báo này!"
            });
        }
        return res.status(200).json({
            success: true,
            message: "Cập nhật trạng thái đã đọc thành công!",
            data: notification 
        });
    }catch(error){
        return res.status(500).json({
            success: false,
            message:"Lỗi khi cập nhật trạng thái thông báo: " + error.message
        });
    }
}
// 3PUT /api/notifications/read-all -> Đánh dấu đọc TẤT CẢ thông báo của User
exports.markAllAsRead = async (req, res) => {
    try{
        await Notification.updateMany(
            {user_id: req.user.id, is_read: false},
            {$set: {is_read: true}}
        );
        return res.status(200).json({
            success: true,
            message: "Đã đánh dấu đọc tất cả thông báo thành công!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi đánh dấu đọc tất cả: " + error.message
        });
    }
};