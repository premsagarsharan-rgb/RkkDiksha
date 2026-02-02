import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export const runtime = "nodejs";

function genViewCode() {
  // Example: SV-8F2KQ7H9 (easy to type)
  const s = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 chars
  return `SV-${s}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();

  // ✅ list only OWN screens (locked)
  const items = await db
    .collection("presentationScreens")
    .find({ createdByUserId: session.userId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .project({ title: 1, viewCode: 1, createdAt: 1, updatedAt: 1, slides: 1, settings: 1 })
    .toArray();

  return NextResponse.json({
    items: items.map((s) => ({
      _id: String(s._id),
      title: s.title || "Untitled",
      viewCode: s.viewCode || null,
      createdAt: s.createdAt || null,
      updatedAt: s.updatedAt || null,
      slidesCount: Array.isArray(s.slides) ? s.slides.length : 0,
      settings: s.settings || null,
    })),
  });
}

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const db = await getDb();
  const now = new Date();

  // unique index for viewCodeLower (create once)
  try {
    await db.collection("presentationScreens").createIndex({ viewCodeLower: 1 }, { unique: true, sparse: true });
  } catch {}

  // generate unique viewCode (retry)
  let viewCode = null;
  for (let i = 0; i < 6; i++) {
    const c = genViewCode();
    const exists = await db.collection("presentationScreens").findOne({ viewCodeLower: c.toLowerCase() }, { projection: { _id: 1 } });
    if (!exists) { viewCode = c; break; }
  }
  if (!viewCode) return NextResponse.json({ error: "VIEWCODE_ALLOCATE_FAILED" }, { status: 500 });

  const doc = {
    title,
    createdByUserId: session.userId,
    createdByUsername: session.username,
    createdAt: now,
    updatedAt: now,

    // ✅ lock code
    viewCode,
    viewCodeLower: viewCode.toLowerCase(),
    viewCodeUpdatedAt: now,

    // cinematic settings
    settings: {
      intervalMs: 3500,
      cardStyle: "movie", // movie | compact
      autoplay: true,
      showControls: true, // viewer sees prev/next + play/pause
      showProgress: true,
      theme: "aurora", // aurora | blue | purple | emerald
    },

    // screen blank by default
    slides: [],
  };

  const r = await db.collection("presentationScreens").insertOne(doc);
  return NextResponse.json({ ok: true, id: String(r.insertedId), viewCode });
}
