import AlbumDetailPage from "@/components/photographer/pages/AlbumDetailPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlbumDetailPage id={id} />;
}
