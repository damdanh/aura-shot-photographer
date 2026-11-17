# Tài liệu Phân tích Usecase Hệ thống Aura Shot

Tài liệu này liệt kê chi tiết các Use case (chức năng) của hệ thống tương thích 100% với logic dự án. Các Usecase được phân chia rạch ròi theo từng vai trò (Role).

Các **Ghi chú bảo vệ trước Hội đồng** được tóm lược ngắn gọn nhằm làm rõ **điểm khác biệt và công dụng** của tính năng so với một website bán hàng thông thường, bám sát đặc thù của ngành Nhiếp ảnh.

---

## 1. Vai trò: Khách hàng (Customer)

### 1.1 Quản lý Tài khoản
- Đăng ký / Đăng nhập / Quên mật khẩu.
- Cập nhật thông tin cá nhân, Ảnh đại diện, Đổi mật khẩu.

### 1.2 Quản lý Giỏ hàng
- Thêm dịch vụ (Gói chụp), sản phẩm số hoặc vật lý vào giỏ hàng.
- Cập nhật, xóa sản phẩm.
  > 📌 **Ghi chú: Giỏ hàng độc quyền**
  > - **Điểm khác biệt**: Không thể thanh toán gộp sản phẩm của nhiều thợ ảnh cùng lúc.
  > - **Công dụng**: Đảm bảo tính minh bạch khi chia hoa hồng và giúp hệ thống tính toán chính xác phí vận chuyển từ kho của từng thợ ảnh cụ thể đến tay khách hàng.

### 1.3 Đặt hàng & Thanh toán
- Tính phí vận chuyển tự động (Qua GHN).
- Tiến hành thanh toán và đặt hàng.
- Xem lịch sử, chi tiết đơn, Hủy đơn, Xác nhận đã nhận hàng.
  > 📌 **Ghi chú: Bảo vệ tài sản số & Chống trùng lịch**
  > - **Phân luồng thanh toán**: Nếu giỏ hàng chỉ có Sản phẩm số (File ảnh), hệ thống chặn hình thức "Thanh toán khi nhận hàng (COD)" nhằm bảo vệ công sức chỉnh sửa của thợ ảnh, tránh rủi ro khách nhận link ảnh xong không trả tiền.
  > - **Chống trùng lịch**: Tự động đối chiếu lịch bận của thợ ảnh để chặn các đơn hàng đặt trùng ngày, giúp thợ ảnh không bị quá tải.
  > - **Luồng hủy/nhận hàng khép kín**: Khách chỉ được hủy khi đơn mới tạo (chưa thanh toán). Nút "Đã nhận hàng" chỉ mở khi thợ ảnh đã bàn giao, đảm bảo quy trình mua bán không bị phá vỡ giữa chừng.

### 1.4 Khám phá & Tương tác
- Tìm kiếm, lọc gian hàng, xem chi tiết và lịch bận của thợ ảnh.
- Viết đánh giá & Nhận xét sau khi hoàn tất đơn hàng.
- Xem gói dịch vụ hệ thống (SaaS) hiển thị công khai trên Landing Page.

### 1.5 Quản lý Album
- Xem Album nội bộ được thợ ảnh chia sẻ riêng biệt.

---

## 2. Vai trò: Thợ ảnh / Studio (Photographer)

### 2.1 Quản lý Tài khoản cá nhân & Gói SaaS
- Có thể cập nhật thông tin cá nhân, chỉnh sửa profile, quên mật khẩu thì được khôi phục mật khẩu qua email.
- **Tạo tài khoản khách hàng**: Giúp thợ ảnh chủ động cấp tài khoản cho khách để khách vào xem ảnh nhanh chóng.
- **Kết nối Google Drive**: Liên kết tài khoản hệ thống với Drive cá nhân để giảm tải lưu trữ.
- **Quản lý Gói dịch vụ hệ thống**: Xem, mua, gia hạn gói dịch vụ hệ thống.

### 2.2 Quản lý Gian hàng
- Cập nhật thông tin giới thiệu, liên hệ, đổi Avatar.
- Cập nhật Lịch bận (Busy Dates).

### 2.3 Quản lý Sản phẩm & Dịch vụ
- Thêm, sửa, ẩn.

### 2.4 Quản lý Đơn hàng
- Xem đơn hàng theo trạng thái.
- Cập nhật trạng thái đơn hàng.
- Bàn giao Đơn hàng (Delivery).

### 2.5 Quản lý Album & Hình ảnh
- **Quản lý Album ảnh**: Thêm, sửa, ẩn.
- **Quản lý Hình ảnh**:
  - **Thêm**: Hệ thống tự động kích hoạt màng lọc AI (AI moderation để chặn các hình ảnh nhạy cảm).
  - **Xóa**: Hệ thống không chỉ xóa bản ghi trong database mà còn thực hiện dọn rác trên cloud store nhằm tối ưu được dung lượng lưu trữ mà khách hàng đã mua.

### 2.6 Xem báo cáo thống kê
- Xem biểu đồ doanh thu.
- Xem số lượng đơn hàng đã bán ra.

### 2.7 Quản lý Khách hàng
- Xem danh sách những người đã từng mua hàng, tải ảnh của mình để chăm sóc lại.
- Trả lời công khai Review của khách.

---

## 3. Vai trò: Quản trị viên (Admin & Super Admin)

### 3.1 Quản lý Thợ ảnh
- Xem danh sách và xử lý vi phạm.
- Admin không xóa trắng dữ liệu của thợ ảnh mà chỉ đóng băng và tước quyền đăng nhập của thợ ảnh.

### 3.2 Quản lý Gian hàng
- Admin không được cấp quyền Thêm và Xóa (Xóa cứng/mềm) gian hàng nhằm đảm bảo quyền sở hữu dữ liệu của thợ ảnh, vì gian hàng tự động gắn liền với tài khoản đăng ký.

### 3.3 Quản lý Kiểm duyệt từ khóa sản phẩm và dịch vụ
- Áp dụng AI và bộ lọc từ khóa quét ngầm ngay khi thợ ảnh bấm nút đăng. Ngăn chặn các từ khóa nhạy cảm, đồi trụy, lừa đảo và ẩn đi.

### 3.4 Quản lý Gói dịch vụ sàn (SaaS)
- Thiết lập cấu hình gói dịch vụ (giá, giới hạn dung lượng, số lượng album).
- Phê duyệt các giao dịch mua gói SaaS.
- Không xóa cứng, để nhằm đảm bảo được tính toàn vẹn dữ liệu cho lịch sử giao dịch của các thợ ảnh đang duy trì và sử dụng gói dịch vụ đó không bị lỗi hệ thống.

### 3.5 Xem báo cáo thống kê
- Xem thống kê doanh thu tổng, tiền hoa hồng hệ thống.
- Dọn dẹp hệ thống (Data Cleanup): Xóa dữ liệu rác, ảnh lỗi để tối ưu dung lượng và chi phí.

### 3.6 Quản lý Mã giảm giá (Vouchers)
- Quản lý mã khuyến mãi dùng chung cho toàn sàn.
