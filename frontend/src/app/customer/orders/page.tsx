import { redirect } from "next/navigation";

type CustomerOrdersPageProps = {
  searchParams: Promise<{
    payment?: string;
    orderId?: string;
    orderCode?: string;
    amount?: string;
    message?: string;
  }>;
};

export default async function CustomerOrdersPage({ searchParams }: CustomerOrdersPageProps) {
  const params = await searchParams;

  // Tương thích với các đơn được backend cũ trả về trước khi có trang thanh toán riêng.
  if (params.payment) {
    const query = new URLSearchParams();
    query.set("payment", params.payment);
    if (params.orderId) query.set("orderId", params.orderId);
    if (params.orderCode) query.set("orderCode", params.orderCode);
    if (params.amount) query.set("amount", params.amount);
    if (params.message) query.set("message", params.message);
    redirect(`/customer/payment-status?${query.toString()}`);
  }

  redirect("/user/order-history");
}
