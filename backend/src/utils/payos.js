const { PayOS } = require('@payos/node');

// Khởi tạo PayOS. Nếu không có biến môi trường thì dùng các thông tin test mặc định hoặc log cảnh báo.
const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID || '',
  process.env.PAYOS_API_KEY || '',
  process.env.PAYOS_CHECKSUM_KEY || ''
);

payos.isConfigured = () => Boolean(
  process.env.PAYOS_CLIENT_ID &&
  process.env.PAYOS_API_KEY &&
  process.env.PAYOS_CHECKSUM_KEY
);

// Cầu nối tương thích ngược cho thư viện @payos/node v2.x
payos.createPaymentLink = (paymentData) => payos.paymentRequests.create(paymentData);
payos.verifyPaymentWebhookData = (webhookData) => payos.webhooks.verify(webhookData);

module.exports = payos;
