import ScreenViewClient from "@/components/ScreenViewClient";

export const runtime = "nodejs";

export default async function ScreenViewPage({ params }) {
  const { viewCode } = await params;
  const code = String(viewCode || "").trim().toUpperCase();

  // ✅ Vercel: polling best
  return <ScreenViewClient viewCode={code} embedded={false} liveMode="poll" pollMs={500} />;
}
