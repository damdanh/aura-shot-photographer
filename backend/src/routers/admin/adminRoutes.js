const express = require('express');
const router = express.Router();
const adminStoreController = require('../../controllers/admin/adminStoreController');
const packageController = require('../../controllers/packageController');
const statsController = require('../../controllers/statsController');
const protect = require('../../middleware/authMiddleware');

// Áp dụng middleware kiểm tra đăng nhập & phân quyền Admin cho tất cả các API phía dưới
router.use(protect);
router.use(protect.restrictTo('admin', 'super_admin'));

// 1. Quản lý danh sách toàn bộ gian hàng thợ ảnh
router.get('/stores', adminStoreController.getAllStores);

// 2. Khóa/mở khóa gian hàng thợ chụp ảnh
router.patch('/stores/:id/ban', adminStoreController.toggleBanStore);


// 5. Gỡ bỏ Album vi phạm nội dung
router.patch('/albums/:id/ban', adminStoreController.adminToggleBanAlbum);

// 7. Thêm mới gói dịch vụ SaaS
router.post('/packages', packageController.createPackage);

// 8. Cập nhật thông số gói dịch vụ SaaS
router.put('/packages/:id', packageController.updatePackage);
router.delete('/packages/:id', packageController.deletePackage);

// 9. Duyệt gói dịch vụ (chờ thanh toán -> active)
router.patch('/packages/approve/:subscriptionId', packageController.approveSubscription);

// 10. Xem báo cáo tổng thể (Tổng doanh thu, hoa hồng, SaaS)
router.get('/stats', statsController.getAdminStats);

const adminController = require('../../controllers/admin/admin.controller');

// 11. Xem danh sách nội dung vi phạm bị AI phát hiện
router.get('/violations', adminController.getViolations);

// 11. Khôi phục nội dung bị gắn cờ vi phạm nhầm
router.patch('/violations/:id/restore', adminController.restoreViolation);

// 12. Lấy danh sách nội dung đang chờ duyệt
router.get('/pending-approvals', adminController.getPendingContents);

// 13. Duyệt nội dung
router.patch('/pending-approvals/:id/approve', adminController.approveContent);

// 14. Từ chối nội dung
router.patch('/pending-approvals/:id/reject', adminController.rejectContent);

module.exports = router;
