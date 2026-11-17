const Cart = require('../models/Cart');
const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/Service');

exports.addToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { item_type = 'product', product_id, service_id, album_id, image_url, photo_id, booking_date, quantity = 1 } = req.body;

        if (item_type === 'product' && !product_id) {
            return res.status(400).json({
                success: false,
                message: "Thiếu mã product_id của sản phẩm"
            });
        }
        if (item_type === 'service' && !service_id) {
            return res.status(400).json({
                success: false,
                message: "Thiếu mã service_id của dịch vụ"
            });
        }

        let targetItem;
        let targetPhotographerId;

        if (item_type === 'product') {
            targetItem = await Product.findById(product_id);
            if (!targetItem) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy sản phẩm này trên hệ thống!"
                });
            }
            targetPhotographerId = targetItem.user_id;
        } else {
            targetItem = await Service.findById(service_id);
            if (!targetItem) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy dịch vụ này trên hệ thống!"
                });
            }
            targetPhotographerId = targetItem.user_id;
        }

        // KIỂM TRA PHÂN QUYỀN: Khách hàng chỉ được mua từ thợ ảnh đã cấp tài khoản cho mình
        const currentUser = await User.findById(userId);
        if (currentUser && currentUser.role === 'customer' && currentUser.photographer_id) {
            if (targetPhotographerId.toString() !== currentUser.photographer_id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Bạn chỉ được phép mua sản phẩm/dịch vụ từ thợ chụp ảnh đã cấp tài khoản cho bạn!"
                });
            }
        }

        // nếu bận thì chặn ko cho thêm vào giỏ hàng
        if(item_type === 'service' && booking_date){
            const { checkPhotographerConflict } = require('../utils/scheduleHelper');
            const conflictResult = await checkPhotographerConflict(targetPhotographerId, booking_date, { userId });
            if (conflictResult.conflict) {
                return res.status(400).json({
                    success: false,
                    message: conflictResult.reason || `Thợ chụp ảnh đã bận trong khung giờ ${booking_date}. Vui lòng chọn giờ khác!`
                });
            }
        }

        let cart = await Cart.findOne({ user_id: userId });
        if (!cart) {
            cart = await Cart.create({ user_id: userId, items: [] });
        }
        // Kiểm tra giỏ hàng độc quyền: Chỉ mua từ 1 Photographer tại một thời điểm
        if (cart.items.length > 0) {
            const firstItem = cart.items[0];
            let existingPhotographerId;
            if (firstItem.item_type === 'service' && firstItem.service_id) {
                const existingService = await Service.findById(firstItem.service_id);
                if (existingService) existingPhotographerId = existingService.user_id;
            } else if (firstItem.product_id) {
                const existingProduct = await Product.findById(firstItem.product_id);
                if (existingProduct) existingPhotographerId = existingProduct.user_id;
            }

            if (existingPhotographerId && existingPhotographerId.toString() !== targetPhotographerId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "Giỏ hàng độc quyền! Bạn chỉ được phép thêm sản phẩm/dịch vụ của duy nhất 1 Nhiếp ảnh gia tại một thời điểm. Vui lòng thanh toán hoặc làm trống giỏ hàng hiện tại trước khi chọn sản phẩm của thợ chụp khác."
                });
            }
        }

            // So khớp item theo type + item_id + album_id + image_url + photo_id
            const itemIndex = cart.items.findIndex(item => {
                const isSameType = item.item_type === item_type;
                const isSameItem = item_type === 'product'
                    ? (item.product_id && item.product_id.toString() === product_id)
                    : (item.service_id && item.service_id.toString() === service_id);

                // So khớp album_id
                const isSameAlbum = album_id
                    ? (item.album_id && item.album_id.toString() === album_id)
                    : !item.album_id;

                // So khớp image_url
                const isSameImage = image_url
                    ? (item.image_url === image_url)
                    : !item.image_url;

                // So khớp photo_id
                const isSamePhoto = photo_id
                    ? (item.photo_id && item.photo_id.toString() === photo_id)
                    : !item.photo_id;
                //So khớp booking_date
                const isSameBookingDate = booking_date
                    ? (item.booking_date === booking_date)
                    : !item.booking_date;
                return isSameType && isSameItem && isSameAlbum && isSameImage && isSamePhoto && isSameBookingDate;
            });

                if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity || 1;
        } else {
            cart.items.push({
                item_type,
                product_id: item_type === 'product' ? product_id : null,
                service_id: item_type === 'service' ? service_id : null,
                album_id: album_id || null,
                image_url: image_url || null,
                photo_id: photo_id || null,
                booking_date: booking_date || null,
                quantity: quantity || 1
            });
        }
        await cart.save();
        
        res.status(200).json({
            success: true,
            message: "Đã thêm sản phẩm/dịch vụ vào giỏ hàng thành công",
            data: cart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Có lỗi xảy ra khi thêm vào giỏ hàng",
            error: error.message
        });
    }
};

exports.getCart = async (req, res) => {
    try{
        const cart = await Cart.findOne({user_id: req.user.id})
        .populate({
            path: 'items.product_id',
            select: 'name price type image_url user_id',
            populate: { path: 'user_id', select: 'full_name phone email avatar_url' }
        })
        .populate({
            path: 'items.service_id',
            select: 'name price type image_url duration user_id',
            populate: { path: 'user_id', select: 'full_name phone email avatar_url' }
        })
        .populate('items.photo_id', 'file_name thumbnail_url');

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giỏ hàng'
            });
        }
        
        let totalCartPrice = 0;
        cart.items.forEach(item => {
            if (item.item_type === 'service' && item.service_id) {
                totalCartPrice += item.service_id.price * item.quantity;
            } else if (item.product_id) {
                totalCartPrice += item.product_id.price * item.quantity;
            }
        });
        res.status(200).json({
            success: true,
            total_items: cart.items.length,
            total_price: totalCartPrice,
            data: cart
        });
    }catch (error) {
        res.status(500).json({
            success: false,
            message: "Có lỗi xảy ra khi lấy giỏ hàng: " + error.message,
            error: error.message
        })
    }
}

exports.removeCartItem = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user_id: req.user.id });
        if (!cart) return res.status(404).json({ success: false, message: 'Không tìm thấy giỏ hàng' });
        const before = cart.items.length;
        cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
        if (cart.items.length === before) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm trong giỏ hàng' });
        await cart.save();
        return res.json({ success: true, message: 'Đã xóa khỏi giỏ hàng', data: cart });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Không thể xóa sản phẩm khỏi giỏ hàng', error: error.message });
    }
};

exports.clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user_id: req.user.id });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giỏ hàng' });
        }
        
        cart.items = [];
        await cart.save();
        
        return res.json({ success: true, message: 'Đã xóa toàn bộ giỏ hàng', data: cart });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Không thể xóa toàn bộ giỏ hàng', error: error.message });
    }
};
