import PhotographerDetailPage from "@/components/admin/pages/PhotographerDetailPage/PhotographerDetailPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhotographerDetailPage id={id} />;
}
