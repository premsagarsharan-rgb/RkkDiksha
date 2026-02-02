import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export const runtime = "nodejs";

function safeStr(x) {
  return String(x || "").trim();
}
function newSlideId() {
  return String(new ObjectId());
}
function isValidDateKey(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}
function genViewCode() {
  const s = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `SV-${s}`;
}
function validateViewCode(code) {
  const c = safeStr(code);
  if (c.length < 4 || c.length > 32) return null;
  // allow only letters/numbers/-/_
  if (!/^[A-Za-z0-9\-_]+$/.test(c)) return null;
  return c;
}

async function findCustomerSnapshot(db, customerId) {
  const _id = new ObjectId(customerId);

  let c = await db.collection("sittingCustomers").findOne({ _id });
  let sourceDb = "sittingCustomers";

  if (!c) { c = await db.collection("pendingCustomers").findOne({ _id }); sourceDb = "pendingCustomers"; }
  if (!c) { c = await db.collection("todayCustomers").findOne({ _id }); sourceDb = "todayCustomers"; }
  if (!c) return null;

  return {
    sourceDb,
    customerId: String(_id),
    name: c.name || "",
    rollNo: c.rollNo || null,
    rollSeq: c.rollSeq || null,
    age: c.age || "",
    gender: c.gender || "",
    address: c.address || "",
    city: c.city || "",
    state: c.state || "",
    country: c.country || "",
  };
}

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { screenId } = await params;
  const db = await getDb();
  const s = await db.collection("presentationScreens").findOne({ _id: new ObjectId(screenId) });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = String(s.createdByUserId || "") === String(session.userId || "");
  if (!isOwner) return NextResponse.json({ error: "Locked (creator only). Use viewCode to view." }, { status: 403 });

  return NextResponse.json({
    screen: {
      _id: String(s._id),
      title: s.title || "Untitled",
      createdByUserId: s.createdByUserId || null,
      createdByUsername: s.createdByUsername || "—",
      createdAt: s.createdAt || null,
      updatedAt: s.updatedAt || null,

      viewCode: s.viewCode || null,
      viewCodeUpdatedAt: s.viewCodeUpdatedAt || null,

      settings: s.settings || { intervalMs: 3500, cardStyle: "movie", autoplay: true, showControls: true, showProgress: true, theme: "aurora" },

      slides: (s.slides || []).map((sl) => ({
        slideId: sl.slideId,
        kind: sl.kind || "SINGLE",
        customerIds: sl.customerIds || (sl.customerId ? [sl.customerId] : []),
        snapshots: sl.snapshots || (sl.snapshot ? [sl.snapshot] : []),
        origin: sl.origin || null,
        createdAt: sl.createdAt || null,
      })),
    },
    viewer: { userId: session.userId, username: session.username, role: session.role, canEdit: true },
  });
}

/**
 * PATCH actions (creator only):
 * - rename: {action:"rename", title}
 * - settings: {action:"settings", settings:{intervalMs, cardStyle, autoplay, showControls, showProgress, theme}}
 * - setViewCode: {action:"setViewCode", viewCode}   (creator can set custom)
 * - regenViewCode: {action:"regenViewCode"}         (creator can regenerate)
 * - addSlide: {action:"addSlide", customerId OR customerIds[], kind, origin}
 * - removeSlide: {action:"removeSlide", slideId}
 * - clearSlides: {action:"clearSlides"}
 * - moveSlide: {action:"moveSlide", slideId, dir:"up"|"down"}
 */
export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { screenId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = safeStr(body?.action);

  const db = await getDb();
  const _id = new ObjectId(screenId);

  const screen = await db.collection("presentationScreens").findOne({ _id });
  if (!screen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = String(screen.createdByUserId || "") === String(session.userId || "");
  if (!isOwner) return NextResponse.json({ error: "Only screen creator can edit" }, { status: 403 });

  const now = new Date();

  if (action === "rename") {
    const title = safeStr(body?.title);
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    await db.collection("presentationScreens").updateOne({ _id }, { $set: { title, updatedAt: now } });
    return NextResponse.json({ ok: true });
  }

  if (action === "settings") {
    const s = body?.settings || {};
    const intervalMs = Number(s.intervalMs || 3500);
    const autoplay = Boolean(s.autoplay);
    const showControls = Boolean(s.showControls);
    const showProgress = Boolean(s.showProgress);
    const cardStyle = safeStr(s.cardStyle || "movie");
    const theme = safeStr(s.theme || "aurora");

    if (!Number.isFinite(intervalMs) || intervalMs < 1200 || intervalMs > 20000) {
      return NextResponse.json({ error: "intervalMs invalid (1200..20000)" }, { status: 400 });
    }
    if (!["movie", "compact"].includes(cardStyle)) return NextResponse.json({ error: "cardStyle invalid" }, { status: 400 });
    if (!["aurora", "blue", "purple", "emerald"].includes(theme)) return NextResponse.json({ error: "theme invalid" }, { status: 400 });

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { settings: { intervalMs, autoplay, showControls, showProgress, cardStyle, theme }, updatedAt: now } }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "setViewCode") {
    const v = validateViewCode(body?.viewCode);
    if (!v) return NextResponse.json({ error: "Invalid viewCode (4..32, A-Z/0-9/-/_)" }, { status: 400 });

    try {
      await db.collection("presentationScreens").createIndex({ viewCodeLower: 1 }, { unique: true, sparse: true });
    } catch {}

    const lower = v.toLowerCase();
    const exists = await db.collection("presentationScreens").findOne(
      { viewCodeLower: lower, _id: { $ne: _id } },
      { projection: { _id: 1 } }
    );
    if (exists) return NextResponse.json({ error: "viewCode already used" }, { status: 409 });

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { viewCode: v, viewCodeLower: lower, viewCodeUpdatedAt: now, updatedAt: now } }
    );
    return NextResponse.json({ ok: true, viewCode: v });
  }

  if (action === "regenViewCode") {
    try {
      await db.collection("presentationScreens").createIndex({ viewCodeLower: 1 }, { unique: true, sparse: true });
    } catch {}

    let viewCode = null;
    for (let i = 0; i < 6; i++) {
      const c = genViewCode();
      const exists = await db.collection("presentationScreens").findOne(
        { viewCodeLower: c.toLowerCase(), _id: { $ne: _id } },
        { projection: { _id: 1 } }
      );
      if (!exists) { viewCode = c; break; }
    }
    if (!viewCode) return NextResponse.json({ error: "VIEWCODE_ALLOCATE_FAILED" }, { status: 500 });

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { viewCode, viewCodeLower: viewCode.toLowerCase(), viewCodeUpdatedAt: now, updatedAt: now } }
    );
    return NextResponse.json({ ok: true, viewCode });
  }

  if (action === "addSlide") {
    const kind = safeStr(body?.kind || "SINGLE").toUpperCase();
    const origin = body?.origin || null;

    let ids = [];
    if (Array.isArray(body?.customerIds) && body.customerIds.length) {
      ids = body.customerIds.map(safeStr).filter(Boolean);
    } else if (body?.customerId) {
      ids = [safeStr(body.customerId)];
    }

    if (!ids.length) return NextResponse.json({ error: "customerId/customerIds required" }, { status: 400 });
    if (!["SINGLE", "COUPLE", "FAMILY"].includes(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

    const snapshots = [];
    for (const cid of ids) {
      const snap = await findCustomerSnapshot(db, cid);
      if (!snap) return NextResponse.json({ error: `Customer not found: ${cid}` }, { status: 404 });
      snapshots.push(snap);
    }

    const slide = {
      slideId: newSlideId(),
      kind,
      customerIds: snapshots.map((s) => s.customerId),
      snapshots,
      origin: origin
        ? {
            date: isValidDateKey(origin.date) ? origin.date : null,
            mode: safeStr(origin.mode),
            containerId: origin.containerId ? String(origin.containerId) : null,
          }
        : null,
      createdAt: now,
      createdByUserId: session.userId,
    };

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $push: { slides: slide }, $set: { updatedAt: now } }
    );
    return NextResponse.json({ ok: true, slideId: slide.slideId });
  }

  if (action === "removeSlide") {
    const slideId = safeStr(body?.slideId);
    if (!slideId) return NextResponse.json({ error: "slideId required" }, { status: 400 });

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $pull: { slides: { slideId } }, $set: { updatedAt: now } }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "clearSlides") {
    await db.collection("presentationScreens").updateOne({ _id }, { $set: { slides: [], updatedAt: now } });
    return NextResponse.json({ ok: true });
  }

  if (action === "moveSlide") {
    const slideId = safeStr(body?.slideId);
    const dir = safeStr(body?.dir);
    if (!slideId) return NextResponse.json({ error: "slideId required" }, { status: 400 });
    if (!["up", "down"].includes(dir)) return NextResponse.json({ error: "dir invalid" }, { status: 400 });

    const slides = Array.isArray(screen.slides) ? [...screen.slides] : [];
    const idx = slides.findIndex((x) => x.slideId === slideId);
    if (idx < 0) return NextResponse.json({ error: "Slide not found" }, { status: 404 });

    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= slides.length) return NextResponse.json({ ok: true });

    const tmp = slides[idx];
    slides[idx] = slides[j];
    slides[j] = tmp;

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { slides, updatedAt: now } }
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
