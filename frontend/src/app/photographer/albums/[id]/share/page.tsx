import AlbumSharePage from "@/components/photographer/pages/AlbumSharePage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlbumSharePage id={id} />;
}
