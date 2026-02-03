import ScreenViewClient from "@/components/ScreenViewClient";

export const runtime = "nodejs";

export default async function ScreenViewPage({ params }) {
  const { viewCode } = await params;
  const code = String(viewCode || "").trim().toUpperCase();

  // SSE instant + poll fallback 1000ms
  return <ScreenViewClient viewCode={code} embedded={false} liveMode="sse" pollMs={1000} />;
}
