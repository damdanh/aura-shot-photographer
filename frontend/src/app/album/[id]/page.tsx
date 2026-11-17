import AlbumViewer from "@/components/customer/AlbumViewer";

export default async function AlbumAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlbumViewer id={id} />;
}

