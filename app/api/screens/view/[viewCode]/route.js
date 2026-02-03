import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { viewCode } = await params;

  const code = String(viewCode || "").trim();
  if (!code) return NextResponse.json({ error: "Missing viewCode" }, { status: 400 });

  // ✅ strict: max 5 (actually exactly 5)
  if (code.length !== 5) {
    return NextResponse.json({ error: "Invalid viewCode length" }, { status: 400 });
  }

  const db = await getDb();
  const s = await db.collection("presentationScreens").findOne(
    { viewCodeLower: code.toLowerCase() },
    { projection: { title: 1, createdByUsername: 1, settings: 1, slides: 1, updatedAt: 1 } }
  );

  if (!s) return NextResponse.json({ error: "Invalid viewCode" }, { status: 404 });

  // manual-only enforced
  const settings = {
    cardStyle: s?.settings?.cardStyle || "movie",
    autoplay: false,
    showControls: true,
    showProgress: false,
    theme: s?.settings?.theme || "aurora",
  };

  return NextResponse.json({
    screen: {
      _id: String(s._id),
      title: s.title || "Untitled",
      createdByUsername: s.createdByUsername || "—",
      updatedAt: s.updatedAt || null,
      settings,
      slides: (s.slides || []).map((sl) => ({
        slideId: sl.slideId,
        kind: sl.kind || "SINGLE",
        customerIds: sl.customerIds || [],
        snapshots: sl.snapshots || [],
        origin: sl.origin || null,
        createdAt: sl.createdAt || null,
      })),
    },
    viewer: { canEdit: false },
  });
}
