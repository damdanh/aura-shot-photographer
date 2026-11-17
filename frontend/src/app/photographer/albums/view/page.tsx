import AlbumDetailPage from "@/components/photographer/pages/AlbumDetailPage";
import AlbumManagePage from "@/components/photographer/pages/AlbumManagePage";
import AlbumConfigAiPage from "@/components/photographer/pages/AlbumConfigAiPage";
import AlbumSharePage from "@/components/photographer/pages/AlbumSharePage";
import AlbumFeedbackPage from "@/components/photographer/pages/AlbumFeedbackPage";
import AlbumExportTxtPage from "@/components/photographer/pages/AlbumExportTxtPage";
import AlbumDeliverPage from "@/components/photographer/pages/AlbumDeliverPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; section?: string }> }) {
  const { id = "", section = "detail" } = await searchParams;

  if (section === "manage") return <AlbumManagePage id={id} />;
  if (section === "config-ai") return <AlbumConfigAiPage id={id} />;
  if (section === "share") return <AlbumSharePage id={id} />;
  if (section === "feedback") return <AlbumFeedbackPage id={id} />;
  if (section === "export-txt") return <AlbumExportTxtPage id={id} />;
  if (section === "deliver") return <AlbumDeliverPage id={id} />;

  return <AlbumDetailPage id={id} />;
}
