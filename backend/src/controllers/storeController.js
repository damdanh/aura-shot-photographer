const User = require('../models/User'); 
const mongoose = require('mongoose');
const PhotographerProfile = require('../models/PhotographerProfile'); 
const authenticateToken = require('../middleware/authMiddleware');
const Order = require('../models/Order')
const Product = require('../models/Product');
const Service = require('../models/Service');
const Album = require('../models/Album');
const Review = require('../models/Review');

const visibleReviewFilter = { is_banned: false, is_safe: { $ne: false } };

const summarizeReviews = (reviews) => {
    const ratingCount = reviews.length;
    const ratingAverage = ratingCount
        ? Math.round((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / ratingCount) * 10) / 10
        : 0;
    return { rating_count: ratingCount, rating_average: ratingAverage };
};

// Hàm Helper: Tự động chuyển đổi Tên gian hàng tiếng Việt có dấu thành chuỗi slug phẳng chuẩn URL
const convertToSlug = (text) => {
    return text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Khử dấu tiếng Việt
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '') // Xóa toàn bộ ký tự đặc biệt
        .replace(/(\s+)/g, '-') // Thay khoảng trắng bằng dấu gạch ngang
        .replace(/-+/g, '-') // Thu gọn nhiều dấu gạch ngang liên tiếp
        .replace(/^-+|-+$/g, ''); // Cắt gạch ngang ở đầu và cuối dòng
};
// //GET /api/users/me -> Lấy thông tin tài khoản đang đăng nhập
// exports.getProfile = async (req, res) => {
//     authenticateToken(req, res, async () => {
//         try {
//             const user = await User.findById(req.user.id).select('-password');
//             if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
//             return res.status(200).json({ success: true, data: user });
//         } catch (error) {
//             return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
//         }
//     });
// };

// // PUT /api/users/me -> Cập nhật thông tin cá nhân (Đồng bộ theo full_name, avatar_url)
// exports.updateProfile = async (req, res) => {
//     authenticateToken(req, res, async () => {
//         try {
//             const { full_name, phone, avatar_url } = req.body;
//             const updatedUser = await User.findByIdAndUpdate(
//                 req.user.id,
//                 { $set: { full_name, phone, avatar_url } },
//                 { new: true }
//             ).select('-password');
//             return res.status(200).json({ success: true, message: "Cập nhật hồ sơ thành công", data: updatedUser });
//         } catch (error) {
//             return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
//         }
//     });
// };

// GET /api/stores -> Lấy toàn bộ gian hàng hiển thị ra Landing Page (Liên kết lấy từ bảng profile)
exports.getPublicStores = async (req, res) => {
    try {
        // Tìm các hồ sơ thợ ảnh, liên kết sang bảng users để kiểm tra tài khoản đó có bị khóa (is_banned) hay không
        const profiles = await PhotographerProfile.find()
            .populate({
                path: 'user_id',
                match: { is_banned: { $ne: true } },
                select: 'full_name avatar_url phone'
            });

        // Lọc bỏ những hồ sơ có tài khoản user đã bị ẩn hoặc bị khóa
        const activeStores = profiles.filter(profile => profile.user_id !== null);

        const photographerIds = activeStores.map(profile => profile.user_id._id);
        const reviewStats = await Review.aggregate([
            { $match: { photographer_id: { $in: photographerIds }, ...visibleReviewFilter } },
            { $group: { _id: '$photographer_id', rating_count: { $sum: 1 }, rating_average: { $avg: '$rating' } } }
        ]);
        const statsByPhotographer = new Map(reviewStats.map(stat => [String(stat._id), stat]));
        const storesWithLiveRatings = activeStores.map(profile => {
            const value = profile.toObject();
            const stats = statsByPhotographer.get(String(profile.user_id._id));
            value.rating_count = stats?.rating_count || 0;
            value.rating_average = stats ? Math.round(stats.rating_average * 10) / 10 : 0;
            return value;
        });

        return res.status(200).json({ success: true, data: storesWithLiveRatings });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// GET /api/stores/featured -> Lấy danh sách thợ ảnh nổi bật theo thuật toán Ranking
exports.getFeaturedStores = async (req, res) => {
    try {
        // 1. Lấy tất cả các hồ sơ có user đang active
        const profiles = await PhotographerProfile.find()
            .populate({
                path: 'user_id',
                match: { is_banned: { $ne: true } },
                select: 'full_name avatar_url phone'
            });

        const activeStores = profiles.filter(profile => profile.user_id !== null);
        const photographerIds = activeStores.map(profile => profile.user_id._id);

        // 2. Tính toán các chỉ số Review (Rating trung bình & Số lượng review)
        const reviewStats = await Review.aggregate([
            { $match: { photographer_id: { $in: photographerIds }, ...visibleReviewFilter } },
            { $group: { _id: '$photographer_id', rating_count: { $sum: 1 }, rating_average: { $avg: '$rating' } } }
        ]);
        const statsByPhotographer = new Map(reviewStats.map(stat => [String(stat._id), stat]));

        // 3. Tính toán số đơn hàng hoàn thành (Completed Orders)
        const orderStats = await Order.aggregate([
            { $match: { photographer_id: { $in: photographerIds }, status: 'Completed' } },
            { $group: { _id: '$photographer_id', completed_count: { $sum: 1 } } }
        ]);
        const ordersByPhotographer = new Map(orderStats.map(stat => [String(stat._id), stat]));

        // 4. Tìm Max values để chuẩn hóa (Normalize) điểm số từ 0 - 100
        let maxCompleted = 1; // Tránh chia 0
        let maxReviews = 1;
        ordersByPhotographer.forEach(stat => { if(stat.completed_count > maxCompleted) maxCompleted = stat.completed_count; });
        statsByPhotographer.forEach(stat => { if(stat.rating_count > maxReviews) maxReviews = stat.rating_count; });

        // 5. Chấm điểm từng Photographer
        const scoredStores = activeStores.map(profile => {
            const value = profile.toObject();
            const pId = String(profile.user_id._id);
            
            const stats = statsByPhotographer.get(pId);
            const ratingAvg = stats ? stats.rating_average : 0;
            const ratingCount = stats ? stats.rating_count : 0;
            
            const orders = ordersByPhotographer.get(pId);
            const completedCount = orders ? orders.completed_count : 0;

            // Chấm điểm Hồ sơ đầy đủ (Tối đa 100đ)
            let profileScore = 0;
            if (value.avatar_url || value.user_id.avatar_url) profileScore += 30;
            if (value.bio && value.bio.length > 20) profileScore += 30;
            if (value.banner) profileScore += 20;
            if (value.skills && value.skills.length > 0) profileScore += 20;

            // Tính điểm thành phần (Quy đổi hệ 100)
            const scoreRating = (ratingAvg / 5) * 100; // Tiêu chí 1: Rating (Max 5)
            const scoreOrders = (completedCount / maxCompleted) * 100; // Tiêu chí 2: Completed Orders
            const scoreReviews = (ratingCount / maxReviews) * 100; // Tiêu chí 3: Total Reviews
            
            // Công thức: Tổng Điểm = (Rating * 40%) + (Completed * 30%) + (Reviews * 20%) + (Profile * 10%)
            const totalScore = (scoreRating * 0.4) + (scoreOrders * 0.3) + (scoreReviews * 0.2) + (profileScore * 0.1);

            value.rating_count = ratingCount;
            value.rating_average = Math.round(ratingAvg * 10) / 10;
            value.completed_orders = completedCount;
            value.ranking_score = Math.round(totalScore * 100) / 100;

            return value;
        });

        // 5.5. Lọc theo Điều kiện tiên quyết (Hard Constraints)
        const qualifiedStores = scoredStores.filter(store => {
            return store.is_verified === true && 
                   store.rating_average >= 4.5 && 
                   store.completed_orders >= 5 &&
                   store.rating_count >= 3;
        });

        // 6. Sắp xếp giảm dần theo Điểm Ranking
        qualifiedStores.sort((a, b) => b.ranking_score - a.ranking_score);

        // 7. Lấy Top 8
        const featuredStores = qualifiedStores.slice(0, 8);

        return res.status(200).json({ success: true, count: featuredStores.length, data: featuredStores });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

//  GET /api/stores/:slug -> Chi tiết gian hàng công khai dựa vào chuỗi slug thực tế
exports.getStoreBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        // Quét trúng hồ sơ bằng slug và tự động lôi thông tin gốc từ bảng users sang kèm
        const profileQuery = mongoose.Types.ObjectId.isValid(slug)
            ? { $or: [{ slug }, { user_id: slug }, { _id: slug }] }
            : { slug };
        const profile = await PhotographerProfile.findOne(profileQuery)
            .populate('user_id', 'full_name email avatar_url phone');
            
        if (!profile || !profile.user_id) return res.status(404).json({ success: false, message: "Gian hàng không tồn tại hoặc đã bị ẩn" });
        const photographerId = profile.user_id._id;
        const [products, services, albums, reviews] = await Promise.all([
            Product.find({ user_id: photographerId, is_active: true, is_banned: false, isDeleted: { $ne: true } }).sort({ is_featured: -1, createdAt: -1 }),
            Service.find({ user_id: photographerId, is_active: true, is_banned: false, isDeleted: { $ne: true } }).sort({ is_featured: -1, createdAt: -1 }),
            Album.find({ user_id: photographerId, status: 'active', is_banned: false }).select('name pin_code createdAt').sort({ createdAt: -1 }),
            Review.find({ photographer_id: photographerId, ...visibleReviewFilter }).populate('customer_id', 'full_name').sort({ createdAt: -1 })
        ]);
        const photographer = { ...profile.toObject(), ...summarizeReviews(reviews) };
        return res.status(200).json({
            success: true,
            data: { photographer, products, services, albums, reviews }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
    }
};

// PUT /api/stores/me -> Thợ ảnh tự cấu hình Seller Center (TỰ ĐỘNG SINH SLUG)
exports.updateMyStore = async (req, res) => {
    authenticateToken(req, res, async () => {
        try {
            const { storeName, bio, skills, banner, location, phone, experience, bank_name, bank_account_number, bank_account_name, operating_hours } = req.body;
            if (!storeName) return res.status(400).json({ success: false, message: "Tên gian hàng không được để trống" });

            // Tự động chuyển đổi tên cửa hàng thành slug phẳng không dấu
            const generatedSlug = convertToSlug(storeName);

            // Chỉ update User.phone khi phone thực sự có nội dung (tránh overwrite bằng chuỗi rỗng)
            const trimmedPhone = phone !== undefined ? String(phone).trim() : undefined;
            if (trimmedPhone) {
                await User.findByIdAndUpdate(req.user.id, { phone: trimmedPhone });
            }

            // Tiến hành cập nhật hoặc tự tạo mới nếu thợ ảnh chưa từng cấu hình gian hàng (upsert)
            const profileUpdate = { 
                storeName, 
                bio, 
                skills, 
                cover_image_url: banner, 
                location: location || "Hà Nội",
                experience,
                bank_name,
                bank_account_number,
                bank_account_name,
                slug: generatedSlug 
            };

            // Lưu giờ hoạt động (operating_hours) nếu được gửi lên
            const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
            if (operating_hours && typeof operating_hours === 'object') {
                const ohStart = String(operating_hours.start || '').trim();
                const ohEnd   = String(operating_hours.end   || '').trim();
                if (timeRegex.test(ohStart) && timeRegex.test(ohEnd)) {
                    profileUpdate['operating_hours.start'] = ohStart;
                    profileUpdate['operating_hours.end']   = ohEnd;
                }
            }
            // Chỉ lưu phone vào Profile khi có nội dung (tránh xóa số cũ)
            if (trimmedPhone) {
                profileUpdate.phone = trimmedPhone;
            }
            const updatedProfile = await PhotographerProfile.findOneAndUpdate(
                { user_id: req.user.id },
                { $set: profileUpdate },
                { new: true, upsert: true }
            );

            return res.status(200).json({ 
                success: true, 
                message: "Cấu hình gian hàng và tự động sinh đường dẫn slug thành công!", 
                data: updatedProfile 
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Lỗi hệ thống: " + error.message });
        }
    });
};

// POST /api/stores/me/avatar -> Tải và lưu ảnh đại diện thật cho nhiếp ảnh gia
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Vui lòng chọn một ảnh đại diện hợp lệ." });
        }

        const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { avatar_url: avatarUrl } },
            { new: true }
        ).select('full_name email avatar_url role');

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản nhiếp ảnh gia." });
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật ảnh đại diện thành công!",
            data: updatedUser
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Không thể cập nhật ảnh đại diện: " + error.message });
    }
};

// POST /api/stores/me/banner -> Tải và lưu ảnh bìa thật cho nhiếp ảnh gia
exports.uploadBanner = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Vui lòng chọn một ảnh bìa hợp lệ." });
        }

        const bannerUrl = `${req.protocol}://${req.get('host')}/uploads/banners/${req.file.filename}`;
        const updatedProfile = await PhotographerProfile.findOneAndUpdate(
            { user_id: req.user.id },
            { $set: { cover_image_url: bannerUrl } },
            { new: true, upsert: true }
        );

        return res.status(200).json({
            success: true,
            message: "Cập nhật ảnh bìa thành công!",
            data: updatedProfile
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Không thể cập nhật ảnh bìa: " + error.message });
    }
};

exports.searchStores = async (req, res) => {
    try {
        const {city, skill, keyword} = req.query;
        let query = {};

        const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const provinceAliases = {
            'Tuyên Quang': ['Tuyên Quang', 'Hà Giang'],
            'Lào Cai': ['Lào Cai', 'Yên Bái'],
            'Thái Nguyên': ['Thái Nguyên', 'Bắc Kạn'],
            'Phú Thọ': ['Phú Thọ', 'Vĩnh Phúc', 'Hòa Bình'],
            'Bắc Ninh': ['Bắc Ninh', 'Bắc Giang'],
            'Hải Phòng': ['Hải Phòng', 'Hải Dương'],
            'Hưng Yên': ['Hưng Yên', 'Thái Bình'],
            'Ninh Bình': ['Ninh Bình', 'Hà Nam', 'Nam Định'],
            'Quảng Trị': ['Quảng Trị', 'Quảng Bình'],
            'Đà Nẵng': ['Đà Nẵng', 'Quảng Nam'],
            'Quảng Ngãi': ['Quảng Ngãi', 'Kon Tum'],
            'Gia Lai': ['Gia Lai', 'Bình Định'],
            'Khánh Hòa': ['Khánh Hòa', 'Ninh Thuận'],
            'Đắk Lắk': ['Đắk Lắk', 'Phú Yên'],
            'Lâm Đồng': ['Lâm Đồng', 'Đắk Nông', 'Bình Thuận'],
            'Đồng Nai': ['Đồng Nai', 'Bình Phước'],
            'Hồ Chí Minh': ['Hồ Chí Minh', 'TP.HCM', 'TP HCM', 'Sài Gòn', 'Bình Dương', 'Bà Rịa', 'Vũng Tàu'],
            'Tây Ninh': ['Tây Ninh', 'Long An'],
            'Đồng Tháp': ['Đồng Tháp', 'Tiền Giang'],
            'Vĩnh Long': ['Vĩnh Long', 'Bến Tre', 'Trà Vinh'],
            'An Giang': ['An Giang', 'Kiên Giang'],
            'Cần Thơ': ['Cần Thơ', 'Hậu Giang', 'Sóc Trăng'],
            'Cà Mau': ['Cà Mau', 'Bạc Liêu']
        };

        if(city) {
            const aliases = provinceAliases[city] || [city];
            query.location = { $regex: aliases.map(escapeRegex).join('|'), $options: 'i'};
        }

        if(skill) {
            query.skills = {$regex: escapeRegex(skill), $options: 'i'};
        }

        if(keyword){
            const safeKeyword = escapeRegex(keyword);
            query.$or = [
                {storeName: {$regex: safeKeyword, $options: 'i'}}, 
                {bio: {$regex: safeKeyword, $options: 'i'}}
            ]
        }
        const profiles = await PhotographerProfile.find(query)
            .populate({
                path:'user_id',
                match: {is_banned: { $ne: true }},
                select:'full_name avatar_url'
            });
        const activeStores = profiles.filter(profile => profile.user_id !== null);
        return res.status(200).json({
            success: true,
            count: activeStores.length,
            data: activeStores
        })
    }
    catch(error){
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + error.message
        })
    }

}
// 1. Thợ ảnh tự cập nhật danh sách ngày bận và khung giờ bận của mình
exports.updateBusyDates = async (req, res) => {
    authenticateToken(req, res, async () => {
        try{
            // chỉ thợ ảnh mới được cấu hình
            if(req.user.role !== 'photographer'){
                return res.status(403).json({
                    success: false,
                    message: "Bạn không có quyền truy cập chức năng này"
                });
            }
            const { busy_dates, busy_slots } = req.body;
            const updateFields = {};
            if (busy_dates && Array.isArray(busy_dates)) {
                updateFields.busy_dates = Array.from(new Set(busy_dates.map(d => String(d).slice(0, 10)).filter(Boolean))).sort();
            }
            if (busy_slots && Array.isArray(busy_slots)) {
                updateFields.busy_slots = busy_slots
                    .filter(slot => slot && slot.date && (slot.start_time || slot.startTime) && (slot.end_time || slot.endTime))
                    .map(slot => ({
                        date: String(slot.date).slice(0, 10),
                        start_time: String(slot.start_time || slot.startTime),
                        end_time: String(slot.end_time || slot.endTime),
                        note: slot.note ? String(slot.note).trim() : "Bận việc riêng"
                    }));
            }

            const profile = await PhotographerProfile.findOneAndUpdate(
                { user_id: req.user.id },
                { $set: updateFields },
                { new: true, upsert: true }
            );

            const manualBusySlots = (profile.busy_slots || []).map(slot => ({
                date: slot.date,
                start_time: slot.start_time,
                end_time: slot.end_time,
                note: slot.note || "Bận cá nhân",
                type: 'manual'
            }));

            return res.status(200).json({
                success: true,
                message: "Cập nhật lịch bận thành công!",
                data: profile.busy_dates || [],
                busy_dates: profile.busy_dates || [],
                busy_slots: manualBusySlots,
                manual_slots: manualBusySlots
            });
        } catch (error){
            return res.status(500).json({
                success: false,
                message: "Lỗi hệ thống: " + error.message
            });
        }
    });
};

// 2. Lấy danh sách toàn bộ ngày bận + khung giờ bận + lịch đã được đặt của thợ ảnh
// GET /api/stores/:id/calendar
exports.getUnavailableCalendar = async (req, res) => {
    try {
        const { id } = req.params;
        const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
        const profile = await PhotographerProfile.findOne({
            $or: [
                { user_id: isValidObjectId ? id : null },
                { _id: isValidObjectId ? id : null },
                { slug: id }
            ].filter(Boolean)
        });
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy hồ sơ thợ ảnh!"
            });
        }
        const targetUserId = profile.user_id ? profile.user_id.toString() : id;
        const manualBusyDates = profile.busy_dates || [];
        const manualBusySlots = (profile.busy_slots || []).map(slot => ({
            date: slot.date,
            start_time: slot.start_time,
            end_time: slot.end_time,
            note: slot.note || "Bận cá nhân",
            type: 'manual'
        }));

        // Lấy giờ hoạt động, fallback về mặc định nếu chưa cấu hình
        const operatingHours = {
            start: (profile.operating_hours && profile.operating_hours.start) || "06:00",
            end:   (profile.operating_hours && profile.operating_hours.end)   || "22:00"
        };
        
        const bookedOrders = await Order.find({
            photographer_id: targetUserId,
            status: { $in: ['Paid', 'Deposit Paid', 'Processing', 'Delivered', 'Completed', 'Confirmed'] },
            booking_date: { $ne: null }
        });
        const fullDayBookedDates = [];
        const orderBusySlots = [];

        bookedOrders.forEach(order => {
            const raw = String(order.booking_date).trim();
            if (raw.includes("T")) {
                const parts = raw.split("T");
                const dateKey = parts[0];
                const timePart = parts[1] || "";
                // Format: HH:mm-HH:mm or HH:mm:ss or HH:mm
                const rangeMatch = timePart.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})/);
                if (rangeMatch) {
                    let start = rangeMatch[1];
                    let end = rangeMatch[2];
                    const startH = parseInt(start.slice(0, 2), 10);
                    let endH = parseInt(end.slice(0, 2), 10);
                    const endM = end.slice(3, 5);
                    if (endH <= startH) {
                        if (endH + 12 > startH && endH + 12 <= 24) {
                            endH += 12;
                        } else {
                            endH = Math.min(23, startH + 2);
                        }
                        end = `${String(Math.min(23, endH)).padStart(2, '0')}:${endM}`;
                    }
                    orderBusySlots.push({
                        date: dateKey,
                        start_time: start,
                        end_time: end,
                        note: `Đơn đặt lịch (${start} - ${end})`,
                        type: 'order'
                    });
                } else {
                    const singleMatch = timePart.match(/^(\d{2}:\d{2})/);
                    if (singleMatch) {
                        const startH = parseInt(singleMatch[1].slice(0, 2), 10);
                        const endH = Math.min(23, startH + 2);
                        const endStr = `${String(endH).padStart(2, '0')}:${singleMatch[1].slice(3, 5)}`;
                        orderBusySlots.push({
                            date: dateKey,
                            start_time: singleMatch[1],
                            end_time: endStr,
                            note: `Đơn đặt lịch (${singleMatch[1]} - ${endStr})`,
                            type: 'order'
                        });
                    } else {
                        fullDayBookedDates.push(dateKey);
                    }
                }
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                fullDayBookedDates.push(raw);
            }
        });

        const allFullBusyDates = Array.from(new Set([...manualBusyDates, ...fullDayBookedDates])).sort();
        const allBusySlots = [...manualBusySlots, ...orderBusySlots];

        return res.status(200).json({
            success: true,
            data: allFullBusyDates,
            full_busy_dates: allFullBusyDates,
            busy_slots: allBusySlots,
            manual_slots: manualBusySlots,
            booked_slots: orderBusySlots,
            operating_hours: operatingHours
        });
    }catch(error){
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + error.message
        });
    }
}
