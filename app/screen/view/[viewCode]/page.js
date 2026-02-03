import ScreenViewClient from "@/components/ScreenViewClient";

export const runtime = "nodejs";

export default async function ScreenViewPage({ params }) {
  const { viewCode } = await params;
  const code = String(viewCode || "").trim().toUpperCase();

  // Full-screen viewer with LIVE polling
  return <ScreenViewClient viewCode={code} embedded={false} pollMs={1000} />;
}
