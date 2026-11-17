const Voucher = require('../models/Voucher');

//[POST] /api/vouchers/apply
exports.applyVoucher = async (req, res) => {
    try {
        const {code, total_amount} = req.body;

        if (!code || !total_amount) {
            return res.status(400).json({ success: false, message: "Thiếu mã voucher hoặc tổng tiền đơn hàng." });
        }

        const voucher = await Voucher.findOne({code: code.toUpperCase()});

        if (!voucher) {
            return res.status(404).json({ success: false, message: "Không tìm thấy voucher" });
        }

        if (!voucher.is_active) {
            return res.status(400).json({success: false, message: "Mã gỉam giá này bị vô hiệu hoá."});
        }

        const now = new Date();
        if (now < voucher.start_date) {
            return res.status(400).json({success: false, message: "Mã giảm giá chưa bắt đầu."})
        }
        if (now > voucher.end_date) {
            return res.status(400).json({sucess: false, message: "Mã giảm giá đã hết hạn."})
        }
        if (voucher.used_count >= voucher.usage_limit) {
            return res.status(400).json({success: false, message: "Mã giảm gía này đã hết lượt sử dụng."});
        }
        if (total_amount < voucher.min_order_value) {
            return res.status(400).json({success: false, message: `Đơn hàng phải từ ${voucher.min_order_value.toLocaleString()}đ để áp dụng mã này.`});
        }
        
        let discount_amount = 0;
        if (voucher.discount_type === 'percent') {
            discount_amount = (total_amount * voucher.discount_value) / 100;
            if (voucher.max_discount_amount && discount_amount > voucher.max_discount_amount) {
                discount_amount = voucher.max_discount_amount;
            }
        }else if (voucher.discount_type === 'fixed') {
            discount_amount = voucher.discount_value;
        }
        if (discount_amount > total_amount) {
            discount_amount = total_amount;
        }
        return res.status(200).json({
            success: true,
            message: "Áp dụng mã giảm giá thành công!",
            data: {
                voucher_code: voucher.code,
                discount_amount: discount_amount,
                final_amount: total_amount - discount_amount
            }
        });
    } catch(error){
        console.error("Lỗi khi áp dụng voucher:", error);
        return res.status(500).json({success: false, message: "Lỗi Server: " + error.message})
    }
};
//[GET] /api/vouchers
exports.createVoucher = async (req, res) => {
    try {
        const voucherData = req.body;
        voucherData.code = voucherData.code.toUpperCase();
        const newVoucher = await Voucher.create(voucherData);
        return res.status(201).json({success: true, message: " Tạo mã giảm giá thành công", data: newVoucher });
    }catch (error) {
        return res.status(500).json({success: false, message: "Lỗi Server: "+ error.message});
    }
};
//[GET] api/voucher
exports.getVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({
            createdAt: -1
        });
        return res.status(200).json({success: true, data: vouchers});
    }catch(error) {
        return res.status(500).json({success: false, message: "Lỗi Server: " + error.message});
    }
};