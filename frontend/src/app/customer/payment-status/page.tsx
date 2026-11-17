import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import styles from "./payment-status.module.css";
import PaymentHistorySync from "@/components/customer/PaymentHistorySync";
import CustomerPaymentGuard from "@/components/customer/CustomerPaymentGuard";
import PaymentAutoRedirect from "@/components/customer/PaymentAutoRedirect";
import PaymentStatusClientActions from "@/components/customer/PaymentStatusClientActions";

type PaymentStatus = "success" | "pending" | "cancelled" | "error";

type PaymentStatusPageProps = {
  searchParams: Promise<{
    payment?: string;
    orderId?: string;
    orderCode?: string;
    amount?: string;
    message?: string;
    qrCode?: string;
    bankBin?: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    description?: string;
  }>;
};

const statusContent: Record<PaymentStatus, {
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
}> = {
  success: {
    icon: "✓",
    eyebrow: "THANH TOÁN THÀNH CÔNG",
    title: "Đơn hàng của bạn đã được xác nhận",
    description: "Aura Shot đã ghi nhận thanh toán. Nhiếp ảnh gia sẽ tiếp nhận và xử lý đơn hàng của bạn.",
  },
  pending: {
    icon: "QR",
    eyebrow: "THANH TOÁN BẰNG MÃ QR",
    title: "Quét mã QR để thanh toán",
    description: "Mở ứng dụng ngân hàng, quét mã và giữ nguyên nội dung chuyển khoản.",
  },
  cancelled: {
    icon: "×",
    eyebrow: "THANH TOÁN ĐÃ HỦY",
    title: "Bạn chưa hoàn tất thanh toán",
    description: "Giao dịch đã được hủy. Bạn có thể quay lại cửa hàng và tạo giao dịch mới khi sẵn sàng.",
  },
  error: {
    icon: "!",
    eyebrow: "KHÔNG THỂ KIỂM TRA THANH TOÁN",
    title: "Đã có lỗi xảy ra",
    description: "Hệ thống chưa xác nhận được kết quả thanh toán. Vui lòng kiểm tra lại cấu hình PayOS hoặc thử lại sau.",
  },
};

function formatAmount(value?: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function PaymentStatusPage({ searchParams }: PaymentStatusPageProps) {
  const params = await searchParams;
  const requestedStatus: PaymentStatus = ["success", "pending", "cancelled", "error"].includes(params.payment || "")
    ? params.payment as PaymentStatus
    : "pending";
  const status: PaymentStatus = requestedStatus;
  const content = statusContent[status];
  const amount = formatAmount(params.amount);

  const bankBin = params.bankBin || process.env.NEXT_PUBLIC_BANK_BIN || "970418"; // BIDV
  const bankName = params.bankName || "VietQR";
  const accountNumber = params.accountNumber || process.env.NEXT_PUBLIC_BANK_ACCOUNT || "8873065045";
  const accountName = params.accountName || process.env.NEXT_PUBLIC_BANK_NAME || "DAM THANH DANH";
  const description = params.description || `AuraShot DH${params.orderCode || params.orderId || ""}`;

  let qrDataUrl: string | null = null;
  if (status === "pending") {
    if (params.qrCode && (params.qrCode.startsWith("http://") || params.qrCode.startsWith("https://"))) {
      // Nếu qrCode đã là đường dẫn ảnh từ img.vietqr.io, dùng trực tiếp ảnh đó
      qrDataUrl = params.qrCode;
    } else if (params.qrCode) {
      // Nếu qrCode là dữ liệu mã hóa thô, sinh mã QR base64
      qrDataUrl = await QRCode.toDataURL(params.qrCode, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 360,
        color: {
          dark: "#07101f",
          light: "#ffffff",
        },
      });
    } else {
      // Tự động tạo link VietQR mặc định
      const bankCode = bankName.split(" ")[0].split("-")[0].trim() || bankBin;
      qrDataUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNumber)}-compact2.jpg?amount=${params.amount || 0}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;
    }
  }

  return (
    <CustomerPaymentGuard orderId={params.orderId} orderCode={params.orderCode}><main className={styles.page}>
      <PaymentHistorySync
        payment={status}
        orderId={params.orderId}
        orderCode={params.orderCode}
        amount={params.amount}
      />
      <div className={styles.glow} aria-hidden="true" />
      <section className={`${styles.card} ${styles[status]} ${qrDataUrl ? styles.pendingWithQr : ""}`}>
        <div className={styles.backButtonWrapper}>
          <Link href="/user/marketplace" className={styles.backButton}>
            ← Quay lại cửa hàng
          </Link>
        </div>

        {qrDataUrl ? (
          <div className={styles.cardContent}>
            {/* Cột trái: Logo + QR Code + Bank details */}
            <div className={styles.leftColumn}>
              <Link className={styles.brand} href="/user">
                <Image
                  src="/auth/logo.jpg"
                  alt="Aura Shot Logo"
                  width={42}
                  height={42}
                  className="rounded-xl object-cover"
                />
                <span>AURA SHOT</span>
              </Link>
              <div className={styles.qrSection}>
                <div className={styles.qrFrame}>
                  <span className={`${styles.corner} ${styles.cornerTopLeft}`} />
                  <span className={`${styles.corner} ${styles.cornerTopRight}`} />
                  <span className={`${styles.corner} ${styles.cornerBottomLeft}`} />
                  <span className={`${styles.corner} ${styles.cornerBottomRight}`} />
                  <Image
                    className={styles.qrImage}
                    src={qrDataUrl}
                    width={300}
                    height={300}
                    unoptimized
                    priority
                    alt={`Mã QR thanh toán của đơn hàng ${params.orderCode || "Aura Shot"}`}
                  />
                </div>
                <div className={styles.bankDetails}>
                  <strong>{accountName}</strong>
                  <span>STK: {accountNumber} ({bankName})</span>
                  <span>Nội dung: {description}</span>
                </div>
              </div>
            </div>

            {/* Cột phải: Tiêu đề + Thông tin đơn hàng + Báo chuyển hướng + Các nút */}
            <div className={styles.rightColumn}>
              <p className={styles.eyebrow}>{content.eyebrow}</p>
              <h1 className={styles.cardTitle}>{content.title}</h1>
              <p className={styles.description}>{content.description}</p>

              {(params.orderCode || params.orderId || amount) && (
                <dl className={styles.summary}>
                  {params.orderCode && (
                    <div>
                      <dt>Mã đơn hàng</dt>
                      <dd>#{params.orderCode}</dd>
                    </div>
                  )}
                  {amount && (
                    <div>
                      <dt>Tổng thanh toán</dt>
                      <dd>{amount}</dd>
                    </div>
                  )}
                  {params.orderId && (
                    <div className={styles.orderId}>
                      <dt>Mã tra cứu</dt>
                      <dd>{params.orderId}</dd>
                    </div>
                  )}
                </dl>
              )}

              <PaymentAutoRedirect
                payment={status}
                orderId={params.orderId}
                orderCode={params.orderCode}
              />

              <PaymentStatusClientActions
                orderId={params.orderId}
                orderCode={params.orderCode}
                status={status}
              />
            </div>
          </div>
        ) : (
          /* Luồng 1 cột mặc định khi không có mã QR (Ví dụ: trạng thái Success, Cancelled, Error) */
          <>
            <Link className={styles.brand} href="/user">
              <Image
                src="/auth/logo.jpg"
                alt="Aura Shot Logo"
                width={42}
                height={42}
                className="rounded-xl object-cover"
              />
              <span>AURA SHOT</span>
            </Link>

            {status !== "pending" && (
              <div className={styles.statusIcon} aria-hidden="true">{content.icon}</div>
            )}
            <p className={styles.eyebrow}>{content.eyebrow}</p>
            <h1>{content.title}</h1>
            <p className={styles.description}>{content.description}</p>

            {(params.orderCode || params.orderId || amount) && (
              <dl className={styles.summary}>
                {params.orderCode && (
                  <div>
                    <dt>Mã đơn hàng</dt>
                    <dd>#{params.orderCode}</dd>
                  </div>
                )}
                {amount && (
                  <div>
                    <dt>Tổng thanh toán</dt>
                    <dd>{amount}</dd>
                  </div>
                )}
                {params.orderId && (
                  <div className={styles.orderId}>
                    <dt>Mã tra cứu</dt>
                    <dd>{params.orderId}</dd>
                  </div>
                )}
              </dl>
            )}

            {status === "error" && params.message && (
              <p className={styles.errorMessage}>{params.message}</p>
            )}

            <PaymentAutoRedirect
              payment={status}
              orderId={params.orderId}
              orderCode={params.orderCode}
            />

            <PaymentStatusClientActions
              orderId={params.orderId}
              orderCode={params.orderCode}
              status={status}
            />
          </>
        )}
      </section>
    </main></CustomerPaymentGuard>
  );
}

