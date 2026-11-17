# 📸 Aura Shot Photographer

**Nền tảng quản lý dịch vụ nhiếp ảnh, album ảnh trực tuyến và trải nghiệm khách hàng.**

Aura Shot Photographer là dự án phát triển website theo mô hình Full-stack, hỗ trợ nhiếp ảnh gia quản lý album, hình ảnh, dịch vụ và hoạt động kinh doanh; đồng thời cung cấp cho khách hàng các chức năng khám phá nhiếp ảnh gia, đặt dịch vụ và mua sản phẩm.

Dự án được thực hiện theo nhóm với mục tiêu xây dựng một hệ thống web có nhiều vai trò người dùng, tích hợp API và các dịch vụ bên thứ ba.

---

## 🎯 Mục tiêu dự án

- Xây dựng nền tảng trực tuyến kết nối nhiếp ảnh gia với khách hàng.
- Hỗ trợ quản lý album và hình ảnh tập trung.
- Cải thiện trải nghiệm tìm kiếm, đặt dịch vụ và mua sắm trực tuyến.
- Tìm hiểu và ứng dụng các công nghệ Frontend, Backend và dịch vụ Cloud trong một sản phẩm thực tế.

## ✨ Chức năng chính

### 1. Khách hàng (Customer)
- Đăng ký, đăng nhập và quản lý tài khoản.
- Khám phá nhiếp ảnh gia, dịch vụ và sản phẩm.
- Xem album ảnh được chia sẻ.
- Đặt lịch và theo dõi đơn hàng.
- Quản lý giỏ hàng và thực hiện thanh toán.

### 2. Nhiếp ảnh gia (Photographer)
- Quản lý hồ sơ cá nhân.
- Tạo và quản lý album ảnh.
- Tải lên và quản lý hình ảnh.
- Quản lý khách hàng và lịch làm việc.
- Quản lý dịch vụ, sản phẩm và đơn hàng.
- Theo dõi gói dịch vụ và hoạt động kinh doanh.

### 3. Quản trị viên (Admin)
- Quản lý người dùng và nhiếp ảnh gia.
- Quản lý đơn hàng, gói dịch vụ và sản phẩm.
- Theo dõi báo cáo và doanh thu.
- Quản lý hoạt động của hệ thống.

### 4. Tích hợp và xử lý hình ảnh
- Tích hợp lưu trữ hình ảnh qua AWS S3.
- Tích hợp Google Drive để quản lý hình ảnh và album.
- Tìm kiếm hình ảnh bằng nhận diện khuôn mặt với AWS Rekognition.
- Tích hợp cổng thanh toán PayOS.
- Tích hợp dịch vụ vận chuyển GHN.

*Lưu ý: Một số chức năng cần cấu hình API Key và tài khoản dịch vụ bên thứ ba để hoạt động.*

---

## 🛠️ Công nghệ sử dụng

### Frontend
- **Next.js** – Framework xây dựng ứng dụng web.
- **React** – Xây dựng giao diện theo component.
- **TypeScript / TSX** – Hỗ trợ phát triển giao diện với kiểu dữ liệu.
- **CSS / CSS Modules** – Thiết kế và quản lý giao diện.

### Backend
- **Node.js** – Môi trường chạy JavaScript phía server.
- **Express.js** – Xây dựng API.
- **MongoDB** – Cơ sở dữ liệu.
- **Mongoose** – Quản lý và thao tác dữ liệu MongoDB.

### Dịch vụ tích hợp
- AWS S3
- AWS Rekognition
- Google Drive API
- PayOS
- GHN
- Redis

---

## 🏗️ Cấu trúc dự án

```text
aura-shot-photographer/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── seeds/
│   │   └── app.js
│   │
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   └── components/
│   │
│   ├── .env.example
│   └── package.json
│
├── .gitignore
├── Readme.md
├── aura_shot_usecases.md
└── Aura_Shot_Trending_Albums_Guide.md
```

---

## 🚀 Hướng dẫn cài đặt

### 1. Yêu cầu môi trường

- Node.js và npm.
- MongoDB.
- Git.
- Các tài khoản dịch vụ bên thứ ba tương ứng với chức năng muốn sử dụng.

### 2. Clone dự án

```bash
git clone <GITHUB_REPOSITORY_URL>
cd aura-shot-photographer
```

### 3. Cài đặt Backend

```bash
cd backend
npm install
```

Tạo file `.env` từ file mẫu:

```bash
```

Trên Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Điền các thông tin cấu hình cần thiết vào `backend/.env`.

### 4. Cài đặt Frontend

Mở terminal mới tại thư mục gốc dự án:

```bash
cd frontend
npm install
```

Tạo file môi trường:

```powershell
Copy-Item .env.example .env
```

Cấu hình các biến cần thiết trong `frontend/.env`.

### 5. Chạy dự án

Chạy Backend và Frontend theo các script được khai báo trong từng file `package.json`.

Ví dụ, nếu package scripts sử dụng tên `dev`:

```bash
npm run dev
```

Frontend và Backend cần được cấu hình địa chỉ kết nối API phù hợp với môi trường đang chạy.

---

## 🔐 Bảo mật và cấu hình môi trường

- Không commit file `.env` lên GitHub.
- Không công khai API Key, Access Token, Client Secret hoặc thông tin đăng nhập.
- Sử dụng `.env.example` để cung cấp danh sách biến môi trường cần thiết.
- Các biến có tiền tố `NEXT_PUBLIC_` có thể được đưa vào bundle frontend và cần được xem là thông tin công khai.
- Cấu hình tài khoản và API Key riêng cho từng môi trường phát triển.

---

## 👨‍💻 Vai trò và đóng góp cá nhân

**Vai trò:** Frontend Developer  
**Quy mô nhóm:** 5 thành viên  
**Định hướng ứng tuyển:** Frontend Developer Intern

Trong dự án Aura Shot, mình phụ trách phát triển giao diện người dùng và tích hợp các chức năng Frontend với Backend API.

### Công việc đã thực hiện

**1. Phát triển giao diện người dùng**
- Xây dựng giao diện responsive và tương tác cho 3 nhóm người dùng: Customer, Photographer/Studio và Admin.
- Sử dụng Next.js, React, TypeScript, Tailwind CSS và Framer Motion.
- Xây dựng các trang quản lý và component giao diện theo từng vai trò người dùng.

**2. Xây dựng hệ thống đặt lịch (Booking Calendar)**
- Phát triển lịch đặt dịch vụ, hiển thị khung giờ làm việc của nhiếp ảnh gia.
- Xử lý trạng thái khung giờ dựa trên `busy_dates` và `operating_hours`.
- Tự động khóa hoặc vô hiệu hóa các khung giờ không khả dụng.
- Bổ sung kiểm tra dữ liệu phía Client nhằm hạn chế tình trạng đặt lịch trùng.

**3. Tích hợp luồng giỏ hàng và thanh toán**
- Phát triển giao diện giỏ hàng và quy trình checkout.
- Tích hợp PayOS/VietQR để theo dõi trạng thái thanh toán và xử lý chuyển hướng sau thanh toán.
- Tích hợp GHN API để tính phí vận chuyển.
- Xử lý các quy tắc nghiệp vụ: đặt cọc 30% cho gói chụp ảnh và vô hiệu hóa thanh toán COD đối với sản phẩm kỹ thuật số.

**4. Tích hợp dữ liệu thời gian thực**
- Tích hợp Socket.IO để đồng bộ và cập nhật dữ liệu trên giao diện.
- Hiển thị thông báo đơn hàng mới.
- Cập nhật trạng thái bàn giao ảnh.
- Hiển thị cảnh báo liên quan đến vi phạm bản quyền mà không cần tải lại trang.

### Công nghệ sử dụng

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Framer Motion.
- **API Integration:** REST API, PayOS, GHN.
- **Real-time:** Socket.IO.
- **Version Control:** Git, GitHub.

### Kinh nghiệm tích lũy

- Phát triển giao diện theo mô hình component-based.
- Xử lý trạng thái và dữ liệu trong các nghiệp vụ phức tạp.
- Tích hợp Frontend với Backend API và dịch vụ bên thứ ba.
- Xây dựng giao diện responsive cho nhiều vai trò người dùng.
- Phối hợp phát triển sản phẩm trong môi trường dự án nhóm.

## 📚 Những kiến thức và kỹ năng tích lũy

- Phát triển giao diện bằng React và Next.js.
- Tổ chức source code theo cấu trúc component.
- Làm việc với TypeScript.
- Tích hợp và sử dụng REST API.
- Xử lý dữ liệu từ Backend.
- Làm việc với Git và GitHub trong dự án nhóm.
- Hiểu quy trình phối hợp giữa Frontend, Backend và Database.

---

## 👥 Thông tin dự án

- **Tên dự án:** Aura Shot Photographer
- **Loại dự án:** Dự án nhóm Full-stack
- **Vai trò định hướng:** Frontend Developer Intern
- **Nhóm thực hiện:** [AURA_SHOT]
- **Repository:** [GitHub URL sau khi public]