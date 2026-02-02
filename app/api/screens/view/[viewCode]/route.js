import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const { viewCode } = await params;
  const code = String(viewCode || "").trim().toLowerCase();
  if (!code) return NextResponse.json({ error: "Missing viewCode" }, { status: 400 });

  const db = await getDb();

  const s = await db.collection("presentationScreens").findOne(
    { viewCodeLower: code },
    { projection: { title: 1, createdByUsername: 1, settings: 1, slides: 1, updatedAt: 1 } }
  );

  if (!s) return NextResponse.json({ error: "Invalid viewCode" }, { status: 404 });

  return NextResponse.json({
    screen: {
      _id: String(s._id),
      title: s.title || "Untitled",
      createdByUsername: s.createdByUsername || "—",
      updatedAt: s.updatedAt || null,
      settings: s.settings || { intervalMs: 3500, cardStyle: "movie", autoplay: true, showControls: true, showProgress: true, theme: "aurora" },
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
