import MarketplaceItemDetailPage from "@/components/customer/MarketplaceItemDetailPage";

export default async function CustomerProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MarketplaceItemDetailPage id={id} kind="product" />;
}
