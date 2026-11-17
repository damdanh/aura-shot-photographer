const PayOS = require('@payos/node');
const Package = require('../models/Package');
const Order = require('../models/Order'); // Model lưu vết giao dịch thanh toán

const payos = new PayOS(
    process.env.PAYOS_CLIENT_ID,
    process.env.PAYOS_API_KEY,
    process.env.PAYOS_CHECKSUM_KEY
);

exports.createPaymentLink = async (req, res) => {
    try {
        const { packageId } = req.body;
        const userId = req.user.id;

        const pkg = await Package.findById(packageId);
        if (!pkg) return res.status(404).json({ success: false, message: "Gói cước không tồn tại!" });

        const orderCode = Date.now(); // Sử dụng timestamp làm mã đơn hàng duy nhất

        const paymentData = {
            orderCode: orderCode,
            amount: pkg.price,
            description: `AuraShot Upgrade ${pkg.name}`,
            cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
            returnUrl: `${process.env.FRONTEND_URL}/payment/success`
        };

        const paymentLinkRes = await payos.createPaymentLink(paymentData);

        // Lưu thông tin đơn hàng nháp vào DB của bạn để xử lý sau khi nhận Webhook
        await Order.create({
            user_id: userId,
            package_id: packageId,
            order_code: orderCode,
            amount: pkg.price,
            status: 'pending'
        });

        res.status(200).json({
            success: true,
            data: { checkoutUrl: paymentLinkRes.checkoutUrl }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
