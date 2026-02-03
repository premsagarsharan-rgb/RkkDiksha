import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export const runtime = "nodejs";

// 5-char code alphabet (no 0,1,O,I,L) -> easy read
const ALPH = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function genViewCode5() {
  const bytes = crypto.randomBytes(5);
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += ALPH[bytes[i] % ALPH.length];
  }
  return out; // e.g. A2K9F
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();

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

  try {
    await db.collection("presentationScreens").createIndex({ viewCodeLower: 1 }, { unique: true, sparse: true });
  } catch {}

  let viewCode = null;
  for (let i = 0; i < 20; i++) {
    const c = genViewCode5();
    const exists = await db.collection("presentationScreens").findOne(
      { viewCodeLower: c.toLowerCase() },
      { projection: { _id: 1 } }
    );
    if (!exists) { viewCode = c; break; }
  }
  if (!viewCode) return NextResponse.json({ error: "VIEWCODE_ALLOCATE_FAILED" }, { status: 500 });

  const doc = {
    title,
    createdByUserId: session.userId,
    createdByUsername: session.username,
    createdAt: now,
    updatedAt: now,

    viewCode,
    viewCodeLower: viewCode.toLowerCase(),
    viewCodeUpdatedAt: now,

    // ✅ manual only
    settings: {
      cardStyle: "movie",
      autoplay: false,
      showControls: true,
      showProgress: false,
      theme: "aurora",
    },

    slides: [],
  };

  const r = await db.collection("presentationScreens").insertOne(doc);
  return NextResponse.json({ ok: true, id: String(r.insertedId), viewCode });
}
