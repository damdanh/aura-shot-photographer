import PhotographerStatusPage from "@/components/admin/pages/PhotographerStatusPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhotographerStatusPage id={id} />;
}
