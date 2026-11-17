# 📘 HƯỚNG DẪN CẤU HÌNH GOOGLE DRIVE API CHO DỰ ÁN AURA SHOT (KHÔNG BỊ HẾT HẠN TOKEN)

Tài liệu này hướng dẫn chi tiết từng bước cách cấu hình Google Drive API trên Google Cloud Console, cách lấy Refresh Token vĩnh viễn và cách deploy hệ thống lên internet mà không gặp lỗi hết hạn Token (`invalid_grant` sau 7 ngày).

---

## 📑 MỤC LỤC
1. [Nguyên nhân gây ra lỗi hết hạn Token (invalid_grant)](#1-nguyên-nhân-gây-ra-lỗi-hết-hạn-token-invalid_grant)
2. [Bước 1: Tạo dự án và Kích hoạt Google Drive API](#bước-1-tạo-dự-án-và-kích-hoạt-google-drive-api)
3. [Bước 2: Cấu hình OAuth Consent Screen & Công bố ứng dụng (Quyết định vĩnh viễn)](#bước-2-cấu-hình-oauth-consent-screen--công-bố-ứng-dụng-quyết-định-vĩnh-viễn)
4. [Bước 3: Tạo thông tin xác thực (Credentials)](#bước-3-tạo-thông-tin-xác-thực-credentials)
5. [Bước 4: Lấy Refresh Token vĩnh viễn qua OAuth2 Playground](#bước-4-lấy-refresh-token-vĩnh-viễn-qua-oauth2-playground)
6. [Bước 5: Lấy ID thư mục cha lưu trữ trên Google Drive](#bước-5-lấy-id-thư-mục-cha-lưu-trữ-trên-google-drive)
7. [Bước 6: Cấu hình biến môi trường trên Server deploy (Production)](#bước-6-cấu-hành-biến-môi-trường-trên-server-deploy-production)
8. [Phương án B: Kích hoạt Mock Mode khi gặp sự cố mạng chập chừng](#phương-án-b-kích-hoạt-mock-mode-khi-gặp-sự-cố-mạng-chập-chừng)

---

## 1. Nguyên nhân gây ra lỗi hết hạn Token (`invalid_grant`)
Mặc định, khi bạn tạo Project trên Google Cloud Console, trạng thái xuất bản (Publishing Status) của ứng dụng sẽ là **"Testing" (Đang thử nghiệm)**.
*   **Chính sách của Google**: Đối với các ứng dụng ở trạng thái "Testing", tất cả các mã thông báo ủy quyền (bao gồm cả Refresh Token) **sẽ tự động hết hạn và bị thu hồi sau đúng 7 ngày**. 
*   **Giải pháp**: Chuyển trạng thái ứng dụng sang **"In Production" (Đang hoạt động)** trên Google Cloud Console.

---

## 🛠️ CHI TIẾT TỪNG BƯỚC THỰC HIỆN

### Bước 1: Tạo dự án và Kích hoạt Google Drive API
1. Truy cập vào [Google Cloud Console](https://console.cloud.google.com/) và đăng nhập bằng tài khoản Gmail của bạn.
2. Click vào ô chọn dự án ở góc trên bên trái -> Chọn **New Project** (Dự án mới). Nhập tên dự án (Ví dụ: `Aura Shot Storage`) và nhấn **Create**.
3. Tại thanh tìm kiếm ở phía trên, gõ **"Google Drive API"**.
4. Chọn kết quả **Google Drive API** và nhấn nút **Enable** (Kích hoạt).

---

### Bước 2: Cấu hình OAuth Consent Screen (Google Auth Platform) & Công bố ứng dụng
1. Ở menu bên trái, chọn **APIs & Services** -> **OAuth consent screen** (Màn hình đồng ý OAuth).
2. Tại màn hình **OAuth Overview**, click vào nút **Get started** màu xanh ở chính giữa màn hình.
3. Thực hiện cấu hình qua các bước hiển thị trên giao diện:
   * **App Information**: 
     * **App name**: Nhập `Aura Shot`.
     * **User support email**: Chọn email Gmail của bạn.
   * **Audience (Đây là bước cấu hình User Type)**: Tích chọn **External** (Người dùng bên ngoài) rồi nhấn **Next**.
   * **Contact Information**: Nhập email của bạn vào mục **Developer contact information** rồi nhấn **Next**.
   * Nhấn **Create** hoặc **Finish** ở bước cuối để hoàn tất thiết lập ban đầu.
4. **BƯỚC QUAN TRỌNG NHẤT**: Ở menu bên trái, chọn tab **Audience**. Tại mục **Publishing status** (Trạng thái xuất bản), click vào nút **PUBLISH APP** (Công bố ứng dụng) và nhấn **Confirm**.
   * *Lưu ý*: Google sẽ hiển thị thông báo ứng dụng cần xác minh (Verification). Bạn **KHÔNG CẦN** gửi hồ sơ xác minh cho Google. Chỉ cần công bố xong thì trạng thái sẽ là "In Production", giúp Refresh Token của bạn có thời hạn vĩnh viễn.

---

### Bước 3: Tạo thông tin xác thực (Credentials)
1. Trên màn hình **Overview** hiện tại, click vào nút **Create OAuth client** (hoặc bạn có thể click chọn tab **Clients** ở menu bên trái rồi chọn **Create client**).
2. Cấu hình các thông tin sau:
   * **Application type**: Chọn **Web application** (Ứng dụng web).
   * **Name**: Đặt tên bất kỳ (Ví dụ: `Aura Shot Web Client`).
   * **Authorized redirect URIs** (Đường dẫn chuyển hướng hợp lệ): Thêm đường dẫn chính xác này vào:
     `https://developers.google.com/oauthplayground`
3. Nhấn **Create**. Một hộp thoại sẽ hiện lên chứa **Your Client ID** và **Your Client Secret**. Hãy copy lại hai mã này.

---

### Bước 4: Lấy Refresh Token vĩnh viễn qua OAuth2 Playground
1. Truy cập trang web hỗ trợ của Google: [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Nhấn vào biểu tượng **bánh răng cài đặt (OAuth 2.0 configuration)** ở góc trên bên phải màn hình:
   * Tích chọn **Use your own OAuth credentials** (Sử dụng thông tin xác thực OAuth của riêng bạn).
   * Nhập **OAuth Client ID** và **OAuth Client Secret** bạn vừa lấy được ở Bước 3.
3. Ở cột bên trái (Step 1: Select & authorize APIs):
   * Cuộn xuống tìm và click vào mục **Drive API v3**.
   * Chọn Scope: `https://www.googleapis.com/auth/drive` (Cho phép toàn quyền quản trị file trên Drive).
   * Nhấn nút **Authorize APIs** màu xanh.
4. Trình duyệt sẽ chuyển sang màn hình đăng nhập Google:
   * Chọn tài khoản Google mà bạn muốn dùng để lưu trữ ảnh của dự án.
   * Nếu có cảnh báo *"Google chưa xác minh ứng dụng này"*, bạn hãy bấm vào **Advanced** (Nâng cao) -> Chọn **Go to Aura Shot (unsafe)** để tiếp tục.
   * Nhấn **Allow** (Cho phép) cấp quyền.
5. Sau khi cấp quyền xong, bạn sẽ tự động được quay trở lại trang OAuth Playground (Step 2):
   * Nhấn nút **Exchange authorization code for tokens** màu xanh.
   * Hệ thống sẽ tự động chuyển sang Step 3. Nhìn xuống khung bên dưới, bạn sẽ thấy ô **Refresh Token**. Hãy copy chuỗi mã này lại.

---

### Bước 5: Lấy ID thư mục cha lưu trữ trên Google Drive
Để tránh các album của thợ ảnh bị lưu lộn xộn ngoài trang chủ Drive, bạn nên tạo riêng một thư mục cha:
1. Truy cập vào [Google Drive](https://drive.google.com/) của bạn.
2. Tạo một thư mục mới (Ví dụ: `Aura_Shot_Storage`).
3. Mở thư mục vừa tạo đó ra. Nhìn lên thanh địa chỉ của trình duyệt, bạn sẽ thấy URL có dạng:
   `https://drive.google.com/drive/folders/1Hn-uIIaCvCZvIu__tK_zEwmJW13oF2YT`
4. Phần ký tự nằm sau chữ `/folders/` (trong ví dụ trên là `1Hn-uIIaCvCZvIu__tK_zEwmJW13oF2YT`) chính là **GOOGLE_DRIVE_FOLDER_ID**. Hãy copy lại chuỗi này.

---

### Bước 6: Cấu hình biến môi trường trên Server deploy (Production)
Khi bạn deploy ứng dụng backend lên các nền tảng online (như Render, Railway, Render, VPS...), bạn **không nên upload file `.env` lên Github**. Thay vào đó, hãy cấu hình các giá trị này vào phần **Environment Variables** (hoặc Config Vars) trên trang quản trị của dịch vụ hosting đó:

* `PORT` = `5001`
* `MONGO_URI` = `Đường dẫn kết nối MongoDB Atlas online của bạn`
* `JWT_SECRET` = `Mã bí mật JWT của bạn`
* `GOOGLE_CLIENT_ID` = *(Điền Client ID lấy ở Bước 3)*
* `GOOGLE_CLIENT_SECRET` = *(Điền Client Secret lấy ở Bước 3)*
* `GOOGLE_REFRESH_TOKEN` = *(Điền Refresh Token vĩnh viễn lấy ở Bước 4)*
* `GOOGLE_DRIVE_FOLDER_ID` = *(Điền ID thư mục cha lấy ở Bước 5)*

Sau khi thêm đầy đủ, nhấn Deploy. Hệ thống online của bạn sẽ chạy thực tế kết nối với Google Drive thật cực kỳ ổn định.

---

## 💡 PHƯƠNG ÁN B: KÍCH HOẠT MOCK MODE KHI GẶP SỰ CỐ MẠNG CHẬP CHỜN
Trong buổi bảo vệ hoặc demo thực tế, nếu internet tại phòng thi quá yếu dẫn đến việc upload ảnh lên Drive thật bị chậm, xoay vòng hoặc lỗi kết nối, bạn hãy chuyển hệ thống sang chế độ giả lập (Mock Mode) trong vòng 5 giây:

1. Mở file `.env` hoặc vào phần cấu hình Environment Variables trên hosting.
2. Thêm ký tự `#` vào trước 4 dòng cấu hình Google Drive để ẩn chúng đi:
   ```env
   # GOOGLE_CLIENT_ID=...
   # GOOGLE_CLIENT_SECRET=...
   # GOOGLE_REFRESH_TOKEN=...
   # GOOGLE_DRIVE_FOLDER_ID=...
   ```
3. Restart lại server backend.
4. **Kết quả**: Hệ thống sẽ tự động chuyển sang Mock Mode:
   * Thợ ảnh vẫn tạo được Album (Hệ thống tự sinh mã thư mục giả lập bắt đầu bằng `mock_folder_...`).
   * Khi upload ảnh, ảnh sẽ được lưu cục bộ trong thư mục `public/uploads` trên server thay vì gửi lên Google Drive, giúp buổi demo diễn ra trơn tru mà không cần internet mạnh.
