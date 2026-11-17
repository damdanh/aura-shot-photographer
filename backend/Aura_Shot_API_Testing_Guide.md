# 📘 CẨM NANG HƯỚNG DẪN KIỂM THỬ (TEST) CHI TIẾT TOÀN BỘ API AURA SHOT TRÊN POSTMAN

Tài liệu này cung cấp hướng dẫn kiểm thử toàn bộ API của dự án **Aura Shot**, được biên soạn dựa trên logic thực tế trong mã nguồn backend của dự án.

*   **Server Base URL**: `http://localhost:5001` (hoặc `http://localhost:5001/api`)
*   **Database**: MongoDB
*   **Tích hợp**: Google Drive API, AWS Rekognition (Face Search), PayOS Payment Gateway, GHN Shipping.

---

## ⚙️ PHẦN 1: THIẾT LẬP MÔI TRƯỜNG POSTMAN (ENVIRONMENT)

Hãy tạo một **Environment** trên Postman (đặt tên là **Aura Shot - Local**) và thêm các biến sau để thuận tiện cho việc kế thừa dữ liệu giữa các API:

| Tên biến (Variable) | Giá trị khởi tạo (Initial Value) | Mô tả |
| :--- | :--- | :--- |
| `base_url` | `http://localhost:5001/api` | Tiền tố đường dẫn API chính |
| `admin_token` | *(Để trống)* | Token JWT của tài khoản Quản trị viên (Admin) |
| `photographer_token` | *(Để trống)* | Token JWT của tài khoản Nhiếp ảnh gia (Photographer) |
| `client_token` | *(Để trống)* | Token JWT của tài khoản Khách hàng (Customer/Client) |
| `album_id` | *(Để trống)* | ID của Album đang test (lấy từ response tạo album) |
| `product_id` | *(Để trống)* | ID của sản phẩm đang test |
| `order_id` | *(Để trống)* | ID của đơn hàng đang test |
| `package_id` | *(Để trống)* | ID của gói SaaS đang test |

> 💡 **Cách thiết lập Bearer Token trong Postman**:
> Tại mỗi Request yêu cầu đăng nhập, truy cập tab **Authorization** -> chọn **Type: Bearer Token** -> nhập vào ô Token cú pháp tương ứng: `{{photographer_token}}`, `{{admin_token}}`, hoặc `{{client_token}}`.

---

## 🔑 PHẦN 2: CHI TIẾT TỪNG ENDPOINT CẦN KIỂM THỬ

---

### 📁 1. NHÓM API XÁC THỰC (AUTHENTICATION)

#### 1.1. Đăng ký tài khoản (Nhiếp ảnh gia / Admin)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/auth/register`
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "email": "photographer_test@gmail.com",
      "password": "password123",
      "full_name": "Nguyễn Văn Photographer",
      "role": "photographer"
    }
    ```
    *(Thay đổi `"role"` thành `"admin"` để tạo tài khoản Admin hoặc `"customer"` để tạo Khách hàng vãng lai)*
*   **Logic Nghiệp vụ**:
    - Kiểm tra email trùng lặp. Mật khẩu bắt buộc phải từ 6 ký tự trở lên.
    - Mã hóa mật khẩu bằng `bcryptjs`.
    - Tạo một giỏ hàng (`Cart`) trống liên kết với User mới này.
    - **Chốt chặn đặc biệt**: Nếu `role` đăng ký là `'photographer'`, hệ thống sẽ tự động khởi tạo Ví tiền (`Wallet` với số dư ban đầu là 0) và Hồ sơ cá nhân (`PhotographerProfile` chứa bio mặc định và tỷ lệ hoa hồng mặc định 10%).

#### 1.2. Đăng nhập hệ thống (Lấy Token xác thực)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/auth/login`
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "email": "photographer_test@gmail.com",
      "password": "password123"
    }
    ```
*   **Hành động**: Nhấn Send, sao chép chuỗi `token` trong response và dán vào biến `photographer_token`, `admin_token`, hoặc `client_token` tương ứng trong tab Environment.
*   **Logic Nghiệp vụ**:
    - Xác minh email và kiểm tra so khớp mật khẩu đã mã hóa.
    - Trả về token JWT có thời hạn 3 ngày chứa thông tin `id` và `role`.

#### 1.3. Yêu cầu lấy lại mật khẩu (Gửi mã OTP qua Email)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/auth/forgot-password`
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "email": "photographer_test@gmail.com"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Xác minh email có tồn tại trên hệ thống hay không.
    - Sinh mã OTP gồm 6 chữ số ngẫu nhiên.
    - Xóa các mã OTP cũ của email này trong DB để tránh trùng lặp.
    - Lưu mã OTP mới vào database và tự động gửi email cho người dùng (qua NodeMailer). Mã OTP có thời hạn sử dụng 5 phút.

#### 1.4. Xác thực OTP & Đổi mật khẩu mới
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/auth/reset-password`
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "email": "photographer_test@gmail.com",
      "otp": "123456",
      "newPassword": "newsecurepassword123"
    }
    ```
    *(Mã OTP lấy từ hộp thư đến Gmail được cấu hình ở biến môi trường hoặc log console)*
*   **Logic Nghiệp vụ**:
    - Kiểm tra cặp `email` + `otp` có khớp và còn hạn 5 phút hay không.
    - Mã hóa mật khẩu mới và lưu vào tài khoản User.
    - Xóa bản ghi OTP đã sử dụng để tránh dùng lại.

#### 1.5. Thợ ảnh tự cấp tài khoản cho Khách hàng (Role Customer)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/auth/create-client`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "email": "khachhang_vip@gmail.com",
      "password": "password123",
      "full_name": "Lê Hoàng Khách Hàng",
      "phone": "0912345678"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Chỉ cho phép tài khoản có role `photographer` thực hiện.
    - Đăng ký tài khoản Khách hàng với thuộc tính `role: 'customer'` và tự động lưu mối liên kết `photographer_id` bằng ID của thợ ảnh đang đăng nhập.
    - Khởi tạo giỏ hàng trống cho khách hàng này.

---

### 📁 2. QUẢN LÝ KHÁCH HÀNG (CLIENTS)

#### 2.1. Thợ ảnh lấy danh sách Khách hàng của riêng mình
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/photographer/clients?page=1&limit=10`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Logic Nghiệp vụ**:
    - Chỉ lấy danh sách tài khoản thỏa mãn đồng thời: `{ role: 'customer', photographer_id: photographerId }`.
    - Sử dụng phép loại bỏ trường nhạy cảm: `.select('-password')`.
    - Áp dụng phân trang (`page`, `limit`) và sắp xếp theo ngày tạo mới nhất (`createdAt: -1`).

---

### 📁 3. HỒ SƠ NGƯỜI DÙNG & GIAN HÀNG (USERS & STORES)

#### 3.1. Lấy thông tin tài khoản đang đăng nhập
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/users/me`
*   **Xác thực**: `Bearer Token` (Bất kỳ token nào)
*   **Logic Nghiệp vụ**:
    - Trích xuất ID từ JWT Token và trả về thông tin chi tiết người dùng ngoại trừ trường `password`.

#### 3.2. Cập nhật thông tin cá nhân
*   **Phương thức**: `PUT`
*   **Đường dẫn**: `{{base_url}}/users/me`
*   **Xác thực**: `Bearer Token` (Bất kỳ token nào)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "full_name": "Nguyễn Văn Photographer Đã Cập Nhật",
      "phone": "0999888777",
      "avatar_url": "https://example.com/avatar.jpg"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Cập nhật các trường `full_name`, `phone`, `avatar_url` cho tài khoản hiện tại.

#### 3.3. Lấy danh sách gian hàng thợ chụp (Landing Page)
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/stores`
*   **Logic Nghiệp vụ**:
    - Public API. Lấy toàn bộ danh sách `PhotographerProfile` trong hệ thống.
    - **Chốt chặn**: Tự động liên kết (`populate`) sang bảng User để kiểm tra xem tài khoản Photographer đó có bị khóa (`is_banned: true`) hay không. Chỉ hiển thị các gian hàng có tài khoản User hoạt động bình thường.

#### 3.4. Xem chi tiết gian hàng thợ chụp theo đường dẫn phẳng (Slug)
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/stores/nguyen-van-photographer-da-cap-nhat`
    *(Thay `nguyen-van-photographer-da-cap-nhat` bằng giá trị `slug` thực tế nhận được ở API 3.3 hoặc 3.5)*
*   **Logic Nghiệp vụ**:
    - Tìm kiếm hồ sơ nhiếp ảnh gia bằng trường `slug`.
    - Tự động liên kết lấy thông tin `full_name`, `email`, `avatar_url` của User đi kèm.

#### 3.5. Thợ ảnh thiết lập/Cập nhật thông tin gian hàng (Seller Center)
*   **Phương thức**: `PUT`
*   **Đường dẫn**: `{{base_url}}/stores/me`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "storeName": "Studio Ngoại Cảnh Ba Vì",
      "bio": "Chuyên chụp ảnh ngoại cảnh tự nhiên, phóng sự cưới và kỷ yếu học sinh.",
      "skills": ["wedding", "outdoor", "portrait"],
      "banner": "https://example.com/banner.jpg"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Yêu cầu bắt buộc phải truyền tên gian hàng (`storeName`).
    - **Tự động hóa Slug**: Hệ thống tự động chuyển đổi tên gian hàng tiếng Việt có dấu thành chuỗi phẳng, không khoảng trắng, không ký tự đặc biệt, nối nhau bằng dấu gạch ngang (Ví dụ: `Studio Ngoại Cảnh Ba Vì` -> `studio-ngoai-canh-ba-vi`) và lưu vào trường `slug`.
    - Sử dụng cơ chế `findOneAndUpdate` với tùy chọn `upsert: true` để tạo mới hồ sơ nếu thợ ảnh chưa từng cấu hình gian hàng.

#### 3.6. Admin lấy toàn bộ danh sách gian hàng để quản lý
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/admin/stores`
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Logic Nghiệp vụ**:
    - Trả về danh sách tất cả các cấu hình gian hàng trên sàn kèm theo thông tin User thợ ảnh (loại trừ trường password).

#### 3.7. Admin khóa/mở khóa gian hàng thợ ảnh
*   **Phương thức**: `PATCH`
*   **Đường dẫn**: `{{base_url}}/admin/stores/ID_USER_CỦA_THỢ_ẢNH/ban`
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Logic Nghiệp vụ**:
    - Tìm tài khoản User theo ID. Đảo ngược giá trị thuộc tính `is_banned` (nếu đang `true` đổi thành `false` và ngược lại).
    - Gian hàng có user bị khóa sẽ ngay lập tức biến mất khỏi Landing Page công khai (xem API 3.3).

---

### 📁 4. GÓI DỊCH VỤ SAAS & CẤU HÌNH SÀN

#### 4.1. Lấy danh sách bảng giá gói dịch vụ lưu trữ (SaaS)
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/packages`
*   **Logic Nghiệp vụ**:
    - Trả về danh sách các gói dịch vụ SaaS đang có trên hệ thống, sắp xếp theo thứ tự giá tăng dần.

#### 4.2. Admin tạo gói dịch vụ SaaS mới
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/admin/packages`
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "name": "Gói Pro 50 Album",
      "max_albums": 50,
      "price": 200000
    }
    ```
*   **Hành động**: Lưu lại giá trị `_id` của gói trả về để đưa vào biến `package_id` trên Postman.
*   **Logic Nghiệp vụ**:
    - Admin tạo một gói lưu trữ giới hạn số lượng album tối đa có thể tạo (`max_albums`) và giá mua (`price`).

#### 4.3. Admin cập nhật thông tin gói dịch vụ SaaS
*   **Phương thức**: `PUT`
*   **Đường dẫn**: `{{base_url}}/admin/packages/{{package_id}}`
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "price": 250000, 
      "max_albums": 60
    }
    ```
*   **Logic Nghiệp vụ**:
    - Cho phép thay đổi thông tin tên gói, số lượng album giới hạn, và mức giá.

#### 4.4. Thợ ảnh đăng ký/gia hạn gói lưu trữ SaaS
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/packages/subscribe`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "packageId": "{{package_id}}"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Tìm thông tin gói cần mua theo `packageId`.
    - Tìm ví tiền của thợ ảnh. So sánh số dư hiện tại với giá của gói. Nếu không đủ tiền, trả về lỗi 400.
    - **Trừ tiền trong ví**: Trừ tiền trực tiếp vào số dư ví của thợ ảnh, đồng thời tạo một bản ghi biến động dòng tiền (`WalletTransaction`) loại `'withdraw'`.
    - **Hủy gói cũ**: Tìm các gói SaaS cũ đang hoạt động (`status: 'active'`) của thợ chụp này và đổi trạng thái thành `'cancelled'`.
    - Khởi tạo gói dịch vụ mới có trạng thái `'active'`, hạn sử dụng mặc định là 30 ngày kể từ ngày mua.

---

### 📁 5. QUẢN LÝ SẢN PHẨM & PHỤ KIỆN MÁY ẢNH (PRODUCTS)

#### 5.1. Thợ ảnh tạo sản phẩm mới (Tích hợp AI kiểm duyệt Badwords)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/products`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON - Hợp lệ)**:
    ```json
    {
      "name": "Ống kính máy ảnh Sony FE 50mm f/1.8",
      "type": "lens",
      "price": 4500000,
      "image_url": "https://example.com/sony-lens.jpg",
      "is_featured": true
    }
    ```
*   🧪 **Kiểm thử Luồng Kiểm Duyệt AI Badwords**:
    Gửi request với nội dung tên sản phẩm có chứa từ cấm trong hệ thống (Ví dụ: `'chịch'`, `'cặc'`, `'lồn'`, `'sex'`):
    ```json
    {
      "name": "Ống kính máy ảnh chụp lồn sex 18+",
      "type": "lens",
      "price": 5000000,
      "image_url": "https://example.com/unsafe.jpg"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Yêu cầu thợ ảnh phải thiết lập gian hàng cá nhân trước.
    - Hệ thống ghép chuỗi `"name" + " " + "type"` và chạy hàm quét từ cấm tự động.
    - **Chốt chặn AI**: Nếu phát hiện từ ngữ nhạy cảm vi phạm, sản phẩm vẫn được tạo ra để lưu vết nhưng thuộc tính `is_banned` được gán bằng `true`, và trạng thái sản phẩm `status` được gán bằng `'banned'` ngay lập tức. Sản phẩm này sẽ bị ẩn khỏi mọi danh sách hiển thị công khai trên sàn.
*   **Hành động**: Lưu lại giá trị `_id` của sản phẩm hợp lệ vào biến `product_id` trên Postman.

#### 5.2. Thợ ảnh cập nhật thông tin sản phẩm
*   **Phương thức**: `PUT`
*   **Đường dẫn**: `{{base_url}}/products/{{product_id}}`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "price": 4800000,
      "name": "Ống kính máy ảnh Sony FE 50mm f/1.8 (Chính hãng)"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Kiểm tra quyền sở hữu sản phẩm (phải đúng là thợ ảnh đã tạo ra sản phẩm đó) hoặc tài khoản admin.
    - Kiểm duyệt lại toàn bộ văn bản sau khi chỉnh sửa. Nếu sửa tên chứa từ cấm, sản phẩm sẽ tự động bị khóa (`is_banned: true`). Nếu sửa từ vi phạm thành từ ngữ trong sạch, sản phẩm sẽ tự động được mở khóa về trạng thái hoạt động bình thường (`is_banned: false`, `status: 'active'`).

#### 5.3. Thợ ảnh chủ động ẩn/hiện sản phẩm
*   **Phương thức**: `PATCH`
*   **Đường dẫn**: `{{base_url}}/products/{{product_id}}/hide`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON - Optional)**:
    ```json
    {
      "is_active": false
    }
    ```
    *(Nếu không truyền `"is_active"`, hệ thống tự động đảo ngược giá trị hiện tại)*
*   **Logic Nghiệp vụ**:
    - Thợ ảnh thay đổi trạng thái hiển thị của sản phẩm. Khi `is_active` là `false`, sản phẩm sẽ bị ẩn khỏi Landing Page công khai của cửa hàng.

#### 5.4. Thợ ảnh xóa mềm sản phẩm
*   **Phương thức**: `DELETE`
*   **Đường dẫn**: `{{base_url}}/products/{{product_id}}`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Logic Nghiệp vụ**:
    - **Quy tắc cấm xóa cứng**: Nhằm bảo toàn tính toàn vẹn dữ liệu cho các hóa đơn/giao dịch cũ đã mua sản phẩm này, hệ thống không xóa hoàn toàn bản ghi khỏi database.
    - Thay vào đó, hệ thống gọi hàm `softDelete()` (sử dụng plugin xóa mềm) để ẩn hoàn toàn sản phẩm khỏi hệ thống.

#### 5.5. Lấy danh sách sản phẩm công khai
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/products?user_id=ID_THỢ_ẢNH&is_featured=true`
*   **Logic Nghiệp vụ**:
    - Public API phục vụ khách hàng. Chỉ hiển thị các sản phẩm có: `is_active: true` và `is_banned: { $ne: true }` (không bị admin khóa/không vi phạm AI).
    - Hỗ trợ tham số lọc theo thợ chụp (`user_id` hoặc `store_id`) và sản phẩm nổi bật (`is_featured`).

#### 5.6. Thợ ảnh lấy toàn bộ danh sách sản phẩm cá nhân (Kể cả sản phẩm bị khóa/ẩn)
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/products/my-list`
*   **Xác thực**: `Bearer Token` (`photographer_token`)

#### 5.7. Admin khóa sản phẩm vi phạm
*   **Phương thức**: `PATCH`
*   **Đường dẫn**: `{{base_url}}/products/{{product_id}}/ban` (Hoặc `{{base_url}}/admin/products/{{product_id}}/ban`)
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Logic Nghiệp vụ**:
    - Khóa sản phẩm vi phạm, gán `is_banned = true`, `status = 'banned'`.

---

### 📁 6. QUẢN LÝ DỊCH VỤ CHỤP & THIẾT KẾ (SERVICES)

#### 6.1. Thợ ảnh tạo dịch vụ mới (Tích hợp AI kiểm duyệt Badwords)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/services`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON - Hợp lệ)**:
    ```json
    {
      "name": "Dịch vụ chụp hình phóng sự cưới ngoại cảnh",
      "type": "shooting",
      "price": 3500000,
      "image_url": "https://example.com/wedding-service.jpg",
      "duration": "1 ngày",
      "is_featured": true
    }
    ```
*   🧪 **Kiểm thử Luồng Kiểm Duyệt AI Badwords**:
    Gửi request với nội dung tên dịch vụ có chứa từ cấm trong hệ thống (Ví dụ: `'chịch'`, `'sex'`):
    ```json
    {
      "name": "Dịch vụ chụp ảnh sex tour 18+",
      "type": "shooting",
      "price": 5000000,
      "image_url": "https://example.com/unsafe.jpg"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Yêu cầu thợ ảnh phải thiết lập gian hàng cá nhân trước.
    - Hệ thống ghép chuỗi `"name" + " " + "type"` và chạy hàm quét từ cấm tự động.
    - **Chốt chặn AI**: Nếu phát hiện từ ngữ nhạy cảm vi phạm, dịch vụ vẫn được tạo ra để lưu vết nhưng thuộc tính `is_banned` được gán bằng `true`, và trạng thái sản phẩm `status` được gán bằng `'banned'` ngay lập tức. Dịch vụ này sẽ bị ẩn khỏi mọi danh sách hiển thị công khai trên sàn.
*   **Hành động**: Lưu lại giá trị `_id` của dịch vụ hợp lệ vào biến `service_id` trên Postman.

#### 6.2. Thợ ảnh cập nhật thông tin dịch vụ
*   **Phương thức**: `PUT`
*   **Đường dẫn**: `{{base_url}}/services/{{service_id}}`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "price": 3800000,
      "duration": "1.5 ngày"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Kiểm tra quyền sở hữu hoặc admin.
    - Kiểm duyệt lại toàn bộ văn bản sau khi chỉnh sửa.

#### 6.3. Thợ ảnh chủ động ẩn/hiện dịch vụ
*   **Phương thức**: `PATCH`
*   **Đường dẫn**: `{{base_url}}/services/{{service_id}}/hide`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON - Optional)**:
    ```json
    {
      "is_active": false
    }
    ```

#### 6.4. Thợ ảnh xóa mềm dịch vụ
*   **Phương thức**: `DELETE`
*   **Đường dẫn**: `{{base_url}}/services/{{service_id}}`
*   **Xác thực**: `Bearer Token` (`photographer_token`)

#### 6.5. Lấy danh sách dịch vụ công khai
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/services?user_id=ID_THỢ_ẢNH&is_featured=true`

#### 6.6. Thợ ảnh lấy toàn bộ danh sách dịch vụ cá nhân (Kể cả dịch vụ bị khóa/ẩn)
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/services/my-list`
*   **Xác thực**: `Bearer Token` (`photographer_token`)

#### 6.7. Admin khóa dịch vụ vi phạm
*   **Phương thức**: `PATCH`
*   **Đường dẫn**: `{{base_url}}/services/{{service_id}}/ban` (Hoặc `{{base_url}}/admin/services/{{service_id}}/ban`)
*   **Xác thực**: `Bearer Token` (`admin_token`)

---

### 📁 7. QUẢN LÝ DỰ ÁN & ALBUM (ALBUMS)

#### 7.1. Thợ ảnh tạo Album dự án mới (Có tích hợp AI Badwords & Tự động tạo thư mục Drive)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/albums` (Hoặc `/api/albums/create`)
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "name": "Album Ảnh Cưới Ngoại Cảnh Đà Lạt",
      "pin_code": "654321"
    }
    ```
*   **Hành động**: Nhấn Send, sao chép giá trị `_id` và `drive_folder_id` của Album trả về dán tương ứng vào các biến `album_id` và `drive_folder_id` trên Postman Environment.
*   **Logic Nghiệp vụ**:
    - Kiểm tra xem thợ ảnh đã cấu hình gian hàng cá nhân chưa.
    - **Kiểm duyệt AI Badwords**: Hệ thống chạy hàm quét từ cấm tự động trên tên album. Nếu chứa từ nhạy cảm (Ví dụ: `'sex'`, `'địt'`), album vẫn được tạo nhưng trạng thái mặc định sẽ bị khóa: `is_banned = true`, `status = 'banned'`, `is_safe = false`, đồng thời lưu lý do vào `ai_moderation_note`.
    - **Kiểm tra giới hạn SaaS**: Truy vấn gói dịch vụ SaaS đang hoạt động của thợ ảnh. So sánh số lượng Album đã tạo hiện tại với giới hạn tối đa (`max_albums`) của gói hiện tại. Nếu vượt quá, chặn đứng và trả về thông báo yêu cầu nâng cấp gói.
    - **Tích hợp Drive**: Gọi tới dịch vụ Google Drive tự động khởi tạo một thư mục trống lưu trữ cho Album này trên tài khoản đám mây của hệ thống.
    - Lưu thông tin Album kèm `drive_folder_id` nhận được vào database (sử dụng trường `user_id` liên kết thợ chụp).

#### 6.2. Xác thực mã PIN truy cập Album (Bảo mật ảnh riêng tư)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/albums/verify-pin`
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "album_id": "{{album_id}}",
      "pin_code": "654321"
    }
    ```
*   **Logic Nghiệp vụ**:
    - So khớp mã PIN do khách hàng nhập vào với trường `pin_code` của Album trong DB. Nếu khớp, cấp quyền truy cập.

#### 6.3. Thợ ảnh đồng bộ danh sách ảnh từ thư mục Google Drive về Database (Có kiểm duyệt AI theo tên file)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/albums/{{album_id}}/sync-drive`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON - Optional)**:
    ```json
    {
      "drive_folder_url": "https://drive.google.com/drive/folders/MÃ_THƯ_MỤC_DRIVE"
    }
    ```
    *(Nếu không truyền, hệ thống sẽ sử dụng mã thư mục Google Drive mặc định được tạo tự động lúc tạo album)*
*   **Logic Nghiệp vụ**:
    - Quét danh sách tệp tin ảnh hiện có trong thư mục Google Drive đó.
    - Duyệt qua từng ảnh, kiểm tra trùng lặp trong database (theo tên file hoặc link ảnh).
    - **Kiểm duyệt tên file bằng AI**: Kiểm duyệt ảnh dựa trên tên file. Nếu tên file chứa từ nhạy cảm (Ví dụ: `nsfw.png`, `porn.jpg`), ảnh được tạo với trạng thái `is_safe = false` và `is_banned = true`.
    - Tạo bản ghi `Photo` mới liên kết với `album_id` kèm theo link ảnh từ Drive vào database.

#### 6.4. Xem danh sách ảnh của Album (Phân trang & Bảo mật đa vai trò)
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/albums/{{album_id}}/photos?page=1&limit=12`
*   **Xác thực**: `Bearer Token` (`client_token` hoặc `customer_token` - *Không bắt buộc*)
*   **Logic Nghiệp vụ**:
    - Chỉ lấy những bức ảnh an toàn và không bị khóa (`is_banned: { $ne: true }`).
    - **Chốt chặn phân quyền Khách hàng**: Nếu tài khoản đăng nhập có vai trò khách hàng (`customer` hoặc `client`), hệ thống sẽ kiểm tra xem khách hàng này có chung thợ ảnh quản lý không (liên kết qua `photographer_id` của customer hoặc `created_by` của client), và kiểm tra quyền được chỉ định truy cập trong bảng `CustomerAlbumAccess`. Nếu có giới hạn truy cập mà khách hàng không được phân quyền, chặn quyền xem ảnh ngay lập tức.
    - Hỗ trợ phân trang bằng `page` và `limit`, sắp xếp ảnh mới tải lên đứng đầu.

#### 6.5. Khách hàng lấy danh sách Album riêng tư được cấp quyền xem
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/albums/client-list`
*   **Xác thực**: `Bearer Token` (`client_token` hoặc `customer_token`)
*   **Logic Nghiệp vụ**:
    - Trích xuất tài khoản khách hàng (chấp nhận cả vai trò `customer` và `client`), tìm kiếm thợ chụp tương ứng (`photographer_id` hoặc `created_by`), lấy danh sách các Album được cấp quyền truy cập trong bảng `CustomerAlbumAccess` và trả về danh sách Album an toàn tương ứng.

#### 6.6. Thợ ảnh xóa hoàn toàn Album (Xóa Cascade)
*   **Phương thức**: `DELETE`
*   **Đường dẫn**: `{{base_url}}/albums/{{album_id}}`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Logic Nghiệp vụ**:
    - Xác minh quyền sở hữu Album hoặc quyền Admin.
    - **Xóa Drive**: Gọi API Google Drive xóa bỏ toàn bộ thư mục vật lý lưu trên Drive.
    - **Xóa MongoDB**: Thực hiện xóa dây chuyền toàn bộ các bức ảnh (`Photo`) liên kết với `album_id` này ra khỏi database.
    - Xóa bản ghi Album gốc.

#### 6.7. Thợ ảnh phân quyền truy cập Album cho Khách hàng (API Mới)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/albums/{{album_id}}/access`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "customer_email": "client_dinhdanh@gmail.com",
      "customer_name": "Trần Văn Định Danh",
      "customer_phone": "0987654321"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Yêu cầu thợ ảnh sở hữu Album thực hiện.
    - Tạo một bản ghi phân quyền `CustomerAlbumAccess` liên kết email của khách hàng với ID Album. Khách hàng sử dụng email này sau khi đăng nhập (kể cả role `customer` hay `client`) sẽ được cấp quyền xem ảnh riêng tư trong album đó.

---

### 📁 8. HÌNH ẢNH & TÌM KIẾM KHUÔN MẶT AI (PHOTOS)

#### 7.1. Tải ảnh trực tiếp lên Google Drive, lập chỉ mục AWS Rekognition và Tự động lưu Database (Tích hợp AI kiểm duyệt hình ảnh)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/photos/upload`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: Không cài đặt `Content-Type` để Postman tự sinh boundary của Multipart form-data.
*   **Dữ liệu mẫu (Body -> form-data)**:
    *   `album_id` (Text): Điền ID Album hiện tại của bạn (`{{album_id}}`).
    *   `photos` (File): Chọn một hoặc nhiều ảnh (tối đa 20 file) trên thiết bị của bạn.
*   **Logic Nghiệp vụ**:
    - Nhận danh sách file từ Multer. Hỗ trợ tự động chuyển đổi định dạng ảnh HEIC/HEIF sang JPEG.
    - Đảm bảo một Face Collection tương ứng trên AWS Rekognition đã được khởi tạo dựa theo mã `drive_folder_id` của album.
    - Duyệt qua từng ảnh:
        1. **Kiểm duyệt an toàn hình ảnh bằng AI**: Chạy bộ lọc hình ảnh nhạy cảm `checkImage` (tích hợp Google Cloud Vision API / Giả lập theo tên file). Nếu phát hiện ảnh nhạy cảm (Ví dụ: tên file chứa `'nsfw'`, `'porn'`, `'sexy'`), ảnh sẽ có thuộc tính `is_safe = false` và `is_banned = true`.
        2. Tải ảnh lên thư mục tương ứng trên Google Drive.
        3. Tải ảnh lên AWS Rekognition để trích xuất khuôn mặt và đánh chỉ mục (Index).
        4. **Lưu trực tiếp vào MongoDB**: Tự động tạo bản ghi `Photo` mới tương ứng chứa liên kết ảnh Drive, dung lượng file, thông tin kiểm duyệt AI (`is_safe`, `ai_moderation_note`) để khách hàng có thể hiển thị ảnh ngay lập tức mà không cần bấm đồng bộ thủ công.
        5. Xóa các file ảnh tạm cục bộ trên server sau khi xử lý xong.

#### 7.2. Tải ảnh Selfie để tìm ảnh chứa khuôn mặt tương ứng trong Album (Face Search)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/photo/face-search` (Hoặc `/api/photo/search-face`)
*   **Headers**: Không cài đặt `Content-Type`.
*   **Dữ liệu mẫu (Body -> form-data)**:
    *   `drive_folder_id` (Text): Điền ID thư mục Google Drive của album ảnh.
    *   `selfie` (File): Chọn 1 file ảnh có chứa khuôn mặt rõ ràng trên máy tính.
*   **Logic Nghiệp vụ**:
    - Nhận file selfie của người dùng, chuyển đổi định dạng HEIC sang JPEG nếu cần.
    - Gọi trực tiếp hàm tìm kiếm khuôn mặt (`searchFacesByImage`) của AWS Rekognition trên collection của thư mục drive tương ứng.
    - **Tối ưu hóa Database**: Hệ thống so khớp chữ ký khuôn mặt trực tiếp trên cloud AWS và trả ngay về danh sách các URL ảnh Drive tìm được mà không cần truy vấn cơ sở dữ liệu MongoDB, giúp tối đa hóa tốc độ tìm kiếm.

---

### 📁 9. ĐƠN HÀNG & CỔNG THANH TOÁN PAYOS (ORDERS)

#### 9.1. Tính phí vận chuyển qua GHN giả lập
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/order/calculate-fee`
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "store_id": "ID_gian_hang",
      "customer_address": "Số 150 Phố Huế, Hai Bà Trưng, Hà Nội"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Nhận địa chỉ nhận hàng của khách hàng.
    - Kiểm tra chuỗi ký tự địa chỉ: Nếu chứa từ khóa `"Hà Nội"`, `"Ha Noi"`, `"Hồ Chí Minh"`, `"Ho Chi Minh"`, `"HCM"` thì áp mức phí nội thành là `25.000 VND` cùng thời gian dự kiến `1-2 ngày`. Các địa điểm tỉnh thành khác chịu mức phí ngoại tỉnh là `45.000 VND` kèm thời gian giao `3-5 ngày`.

#### 9.2. Đặt hàng sản phẩm/dịch vụ (Hỗ trợ cả Thành viên và Khách vãng lai)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/order/checkout`
*   **Xác thực**: `Bearer Token` (`client_token` - *Không bắt buộc*)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "customer_name": "Nguyễn Hoàng Nam",
      "phone": "0911559988",
      "shipping_address": "Phố Huế, Hai Bà Trưng, Hà Nội",
      "note": "Vui lòng in ảnh viền trắng mờ",
      "items": [
        {
          "product_id": "{{product_id}}",
          "quantity": 2,
          "album_id": "{{album_id}}",
          "image_url": "https://drive.google.com/uc?id=MÃ_ẢNH_ĐÃ_CHỌN",
          "customer_note": "In khổ 10x15"
        }
      ]
    }
    ```
*   **Hành động**: Lưu lại giá trị `order_id` và `orderCode`, sao chép liên kết thanh toán `paymentUrl` từ response trả về. Mở link `paymentUrl` trên trình duyệt để kiểm tra giao diện PayOS và thực hiện thanh toán.
*   **Logic Nghiệp vụ**:
    - Nhận danh sách sản phẩm từ body. Nếu không truyền danh sách sản phẩm nhưng có đăng nhập, hệ thống tự động tải các sản phẩm hiện có từ giỏ hàng trong database của khách hàng đó.
    - Tính tổng số tiền hóa đơn. Tạo bản ghi đơn hàng với trạng thái mặc định ban đầu là `'Pending'`.
    - Tạo các bản ghi chi tiết đơn hàng (`OrderItem`) ghi nhận ID sản phẩm/dịch vụ, ảnh chọn in, số lượng và đơn giá.
    - Làm sạch giỏ hàng hiện tại của khách hàng.
    - Tạo và trả về đường dẫn thanh toán `paymentUrl` trỏ đến cổng PayOS.

#### 9.3. Webhook cập nhật kết quả thanh toán tự động (PayOS Webhook)
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/order/payos-webhook`
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON - Giả lập thanh toán thành công)**:
    ```json
    {
      "bypassSignature": true,
      "data": {
        "orderCode": MÃ_ORDER_CODE_DẠNG_SỐ
      }
    }
    ```
*   **Logic Nghiệp vụ**:
    - Xác thực chữ ký mã hóa của PayOS để bảo mật.
    - **Cơ chế Test**: Cho phép bỏ qua xác thực chữ ký bảo mật ở môi trường phát triển nếu truyền `bypassSignature: true` trong môi trường không phải production.
    - So khớp tổng số tiền giao dịch và kiểm tra trạng thái đơn hàng.
    - **Cập nhật doanh thu**: Nếu thanh toán thành công:
        1. Chuyển trạng thái đơn hàng thành `'Completed'`.
        2. Tự động tìm kiếm thợ chụp sở hữu các sản phẩm/dịch vụ có trong đơn hàng.
        3. Cộng trực tiếp tiền doanh thu tương ứng vào tài khoản ví tiền (`Wallet`) của thợ ảnh đó.
        4. Ghi nhận lịch sử biến động dòng tiền (`WalletTransaction`) loại `'revenue'` liên kết trực tiếp với ID đơn hàng.

#### 9.4. Thợ ảnh xem danh sách đơn hàng được gửi đến gian hàng của mình
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/order`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Logic Nghiệp vụ**:
    - Tìm toàn bộ các chi tiết đơn hàng có chứa sản phẩm thuộc về thợ ảnh đang đăng nhập.
    - Gộp nhóm (Group) các mặt hàng theo mã đơn hàng gốc và sắp xếp theo ngày đặt mới nhất.

#### 9.5. Thợ ảnh cập nhật trạng thái xử lý đơn hàng
*   **Phương thức**: `PATCH`
*   **Đường dẫn**: `{{base_url}}/order/{{order_id}}/status`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "status": "Processing"
    }
    ```
    *(Các trạng thái hợp lệ: `Pending`, `Paid`, `Processing`, `Delivered`, `Completed`)*
*   **Logic Nghiệp vụ**:
    - Xác nhận xem đơn hàng có chứa sản phẩm thuộc gian hàng của thợ ảnh này hay không.
    - Cập nhật trạng thái đơn hàng sang trạng thái mới.

#### 9.6. Thợ ảnh bàn giao file ảnh hoàn thiện của đơn hàng ( Photoshop Output )
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/order/{{order_id}}/delivery`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "delivered_urls": [
        "https://drive.google.com/uc?id=file_da_photoshop_1",
        "https://drive.google.com/uc?id=file_da_photoshop_2"
      ]
    }
    ```
*   **Logic Nghiệp vụ**:
    - Kiểm tra quyền thợ ảnh.
    - Cập nhật thuộc tính trạng thái đơn hàng thành `'Delivered'` đồng thời ghi nhận mảng link ảnh đã xử lý xong vào trường `delivered_urls` trên đơn hàng để khách hàng tải về.

---

### 📁 10. THỐNG KÊ DOANH THU & VÍ TIỀN (WALLET & STATS)

#### 10.1. Xem số dư ví và lịch sử dòng tiền thợ ảnh
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/wallet/me`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Logic Nghiệp vụ**:
    - Trả về ID ví, số dư khả dụng hiện tại, và toàn bộ lịch sử giao dịch tăng/giảm tiền xếp theo thời gian mới nhất. Nếu thợ ảnh chưa có ví, hệ thống tự động khởi tạo.

#### 10.2. Thợ ảnh xem biểu đồ doanh thu và lượng đơn hàng
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/store/stats`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Logic Nghiệp vụ**:
    - Tổng hợp số dư, tổng doanh thu thực tế nhận được, tổng số đơn bán thành công.
    - Nhóm doanh thu và đếm số lượng đơn hàng theo từng tháng (Định dạng tháng: `YYYY-MM`) để trả về dữ liệu vẽ biểu đồ ở frontend.

#### 10.3. Thợ ảnh xem danh sách khách hàng đã từng mua hàng
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/store/customers`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Logic Nghiệp vụ**:
    - Quét các đơn hàng đã hoàn tất có chứa sản phẩm của thợ ảnh.
    - Thu gom thông tin và gộp nhóm theo số điện thoại hoặc tên khách hàng.
    - Trả về danh sách gồm: tên khách hàng, số điện thoại, email, tổng số đơn đã mua, tổng số tiền khách hàng đã chi tiêu tại gian hàng.

#### 10.4. Admin xem thống kê doanh thu toàn sàn từ phí SaaS
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/admin/stats`
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Logic Nghiệp vụ**:
    - Tính tổng giá trị giao dịch của các đơn hàng hoàn tất trên sàn.
    - Đếm số lượng tài khoản thợ chụp và khách hàng.
    - Tính tổng doanh thu thu được từ việc bán các gói dịch vụ SaaS cho các thợ chụp dựa theo lịch sử đăng ký gói (`UserPackage`).

---

### 📁 11. YÊU CẦU RÚT TIỀN (WITHDRAWAL)

#### 11.1. Thợ ảnh tạo yêu cầu rút tiền tự động
*   **Phương thức**: `POST`
*   **Đường dẫn**: `{{base_url}}/withdraw/request`
*   **Xác thực**: `Bearer Token` (`photographer_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "amount": 500000,
      "bank_name": "Vietcombank",
      "account_name": "NGUYEN VAN PHOTOGRAPHER",
      "account_number": "101293848123"
    }
    ```
*   **Logic Nghiệp vụ**:
    - Nhận số tiền rút và thông tin tài khoản ngân hàng. Yêu cầu số tiền phải lớn hơn 0.
    - Kiểm tra số dư ví tiền của thợ ảnh có đủ để rút hay không.
    - **Cơ chế tự động phê duyệt**: Nhằm tối ưu hóa luồng thanh toán, hệ thống thực hiện trừ tiền trong ví của thợ ảnh ngay lập tức và tạo lệnh rút tiền với trạng thái mặc định đã được duyệt `'approved'`.
    - Lưu vết giao dịch biến động ví (`WalletTransaction`) với số tiền âm tương ứng kèm theo ghi chú.

#### 11.2. Admin xem danh sách toàn bộ yêu cầu rút tiền
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/admin/payouts?status=approved`
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Logic Nghiệp vụ**:
    - Trả về danh sách các yêu cầu rút tiền trong hệ thống (có hỗ trợ filter query theo trạng thái `status`), liên kết thông tin họ tên, email và số điện thoại của thợ ảnh yêu cầu.


---


### 📁 12. HẬU KIỂM VI PHẠM NỘI DUNG BẰNG AI (MODERATION & VIOLATIONS)

#### 12.1. Admin lấy danh sách toàn bộ nội dung vi phạm bị AI gắn cờ khóa
*   **Phương thức**: `GET`
*   **Đường dẫn**: `{{base_url}}/admin/violations`
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Logic Nghiệp vụ**:
    - Hệ thống thực hiện quét đồng thời cả 3 Collection: `Products`, `Albums` và `Photos` có trường `{ is_safe: false }` (Nội dung bị bộ lọc AI từ ngữ/hình ảnh chặn tự động lúc thợ chụp tạo sản phẩm, album, hoặc upload/sync hình ảnh).
    - Map và gán thuộc tính nhận diện loại bản ghi tương ứng là: `type: 'product'`, `type: 'album'`, hoặc `type: 'photo'`.
    - Gộp cả 3 mảng lại thành một danh sách duy nhất và sắp xếp theo ngày phát hiện vi phạm mới nhất để admin dễ dàng kiểm tra.

#### 12.2. Admin phê duyệt mở khóa nội dung bị AI gắn cờ nhầm
*   **Phương thức**: `PATCH`
*   **Đường dẫn**: `{{base_url}}/admin/violations/ID_BẢN_GHI_VI_PHẠM/restore`
*   **Xác thực**: `Bearer Token` (`admin_token`)
*   **Headers**: `Content-Type: application/json`
*   **Dữ liệu mẫu (Body JSON)**:
    ```json
    {
      "type": "product"
    }
    ```
    *(Ghi chú: Giá trị `"type"` bắt buộc truyền và phải trùng khớp với loại bản ghi cần khôi phục: `"product"`, `"album"`, hoặc `"photo"`)*
*   **Logic Nghiệp vụ**:
    - Nhận diện model tương ứng dựa theo thuộc tính `type`.
    - Cập nhật bản ghi: Thiết lập thuộc tính an toàn `is_safe: true`, xóa bỏ ghi chú vi phạm của AI `ai_moderation_note: null` và lưu lại vết tài khoản Admin thực hiện khôi phục vào thuộc tính `restored_by`.
    - Nội dung sau khi khôi phục sẽ xuất hiện và hoạt động bình thường trên sàn.
