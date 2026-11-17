# Hướng Dẫn Phát Triển Tính Năng: Album Nổi Bật (Trending Albums) trên Landing Page

Tài liệu này được soạn thảo để thống nhất logic và luồng công việc giữa các team (Frontend, Backend) khi phát triển tính năng hiển thị **Album Nổi Bật** trên trang chủ (Landing Page) của hệ thống Aura Shot.

---

## 1. Bài Toán Business Logic & Lỗ Hổng Quyền Riêng Tư
Aura Shot là nền tảng đặt lịch chụp ảnh, các Album sinh ra thường chứa ảnh cá nhân nhạy cảm (Cưới, Kỷ yếu, Tiệc riêng) và bị khóa cứng theo Email của khách hàng.
**Vấn đề:** Nếu chúng ta lấy ngẫu nhiên các album ra trang chủ cho khách vãng lai xem, chúng ta sẽ vi phạm nghiêm trọng quyền riêng tư và bị khách hàng kiện.
**Cách giải quyết (Đã chốt):**
- **Thợ ảnh tự quyết định:** Backend đã thêm cờ `is_public` vào Model Album. Thợ ảnh muốn dùng Album nào làm Portfolio (Hồ sơ năng lực) để quảng cáo thì phải tự tay bật cờ này. Trách nhiệm xin phép khách hàng thuộc về thợ ảnh.
- **Kế thừa Đánh giá:** Vì Album Private chỉ có 1 khách hàng xem, nên nó không thể tự tích lũy điểm Đánh giá (Rating) được. Giải pháp là **Album sẽ kế thừa điểm Uy tín (average_rating) của chính Thợ ảnh** tạo ra nó.

---

## 2. Phần Việc Của BACKEND (Đã hoàn thành)

Backend đã cập nhật cấu trúc và API để hỗ trợ tính năng này, cụ thể:

### A. Cập nhật Model Database
1. **`models/Album.js`:** Thêm trường `is_public` (Boolean, mặc định `false`).
2. **`models/PhotographerProfile.js`:** Thêm trường `average_rating` (Number, mặc định `0`) và `review_count` (Number, mặc định `0`).

### B. API Mới: Lấy danh sách Album Nổi Bật
- **Endpoint:** `GET /api/album/public/trending` (Không cần Token / Public Route).
- **Logic Aggregation (Thuật toán sắp xếp):**
  - Chỉ lấy Album có `is_public: true` (Thợ ảnh cho phép hiển thị) **VÀ** `is_safe: true` (Đã qua màng lọc AI, không chứa ảnh đồi trụy).
  - Sắp xếp ưu tiên: `average_rating` giảm dần ➡️ `review_count` giảm dần ➡️ `createdAt` (mới nhất).
  - Giới hạn trả về: Mặc định `LIMIT 10` (Có thể truyền `?limit=15` qua query).

*(Note cho Backend dev: Nếu dự án có sử dụng Redis, hãy bọc hàm `getTrendingAlbums` trong controller qua cache để tối ưu load time cho trang chủ).*

---

## 3. Phần Việc Của FRONTEND (Cần thực hiện)

Team Frontend cần bám sát 3 đầu việc sau để khớp với Backend:

### Task 1: Trang Quản lý Album (Photographer Dashboard)
- **UI/UX:** Trong Form Tạo mới hoặc Chỉnh sửa Album, thêm một Checkbox/Toggle Switch với nội dung: *"Hiển thị công khai làm Portfolio trên trang chủ"*.
- **Data Binding:** Map trường này với key `is_public` khi gửi request lên Backend.
- **Cảnh báo Pháp lý (Bắt buộc):** Khi User gạt mở Toggle này, **phải** hiển thị một popup/tooltip cảnh báo: *"Lưu ý: Bật tính năng này sẽ hiển thị toàn bộ ảnh ra trang chủ. Vui lòng đảm bảo bạn đã xin phép khách hàng để bảo vệ quyền riêng tư!"*.

### Task 2: Giao diện Landing Page (Trang chủ)
- **UI Section:** Tạo khu vực "Album Nổi Bật" (Carousel hoặc Grid) gọi data từ API `GET /api/album/public/trending`.
- **Hiển thị Dữ liệu (Card):** Mỗi thẻ Album cần show các thông tin được Backend trả về:
  - Tên Album (`name`) và Ảnh Cover.
  - Tên Thợ ảnh (`photographer_name`) & Avatar (`photographer_avatar`).
  - **Điểm đánh giá** (`average_rating` ⭐) và **Số lượt đánh giá** (`review_count`).

### Task 3: Trang xem chi tiết Album Công khai (Public Viewer)
- **Bỏ chặn Email:** Hiện tại nếu vào URL xem Album, Frontend đang gọi API và bắt nhập mã PIN / Email. Đối với các Album click từ Landing Page (là album có `is_public == true`), Frontend cần xử lý logic Bypass (bỏ qua) bước bắt nhập Email này để khách vãng lai có thể xem thẳng ảnh.
- **CTA (Call-to-action):** Bổ sung nút **"Đặt lịch ngay với thợ ảnh này"** trong trang xem ảnh để dẫn khách vào luồng mua hàng (Giỏ hàng).


