import FeaturedProProfilePage from "@/components/public/FeaturedProProfilePage";

export default function FeaturedProProfileRoute({
  params,
}: {
  params: { slug: string };
}) {
  return <FeaturedProProfilePage params={params} />;
}
