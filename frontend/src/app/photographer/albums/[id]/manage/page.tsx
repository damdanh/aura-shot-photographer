import AlbumManagePage from "@/components/photographer/pages/AlbumManagePage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlbumManagePage id={id} />;
}
