import PublicAlbumViewer from "@/components/customer/PublicAlbumViewer";

export default async function PublicAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicAlbumViewer id={id} />;
}
