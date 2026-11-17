import AlbumConfigAiPage from "@/components/photographer/pages/AlbumConfigAiPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlbumConfigAiPage id={id} />;
}
