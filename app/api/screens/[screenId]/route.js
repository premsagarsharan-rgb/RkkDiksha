import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import crypto from "crypto";
import { publishScreen } from "@/lib/screenBus";

export const runtime = "nodejs";

const ALPH = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function safeStr(x) {
  return String(x || "").trim();
}
function newSlideId() {
  return String(new ObjectId());
}
function isValidDateKey(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function genViewCode5() {
  const bytes = crypto.randomBytes(5);
  let out = "";
  for (let i = 0; i < 5; i++) out += ALPH[bytes[i] % ALPH.length];
  return out;
}
function validateViewCode5(code) {
  const c = safeStr(code).toUpperCase();
  if (c.length !== 5) return null;
  for (const ch of c) if (!ALPH.includes(ch)) return null;
  return c;
}

async function findCustomerSnapshot(db, customerId) {
  const _id = new ObjectId(customerId);

  let c = await db.collection("sittingCustomers").findOne({ _id });
  let sourceDb = "sittingCustomers";

  if (!c) {
    c = await db.collection("pendingCustomers").findOne({ _id });
    sourceDb = "pendingCustomers";
  }
  if (!c) {
    c = await db.collection("todayCustomers").findOne({ _id });
    sourceDb = "todayCustomers";
  }
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

function notifyUpdate(codeLower, payload) {
  if (!codeLower) return;
  publishScreen(String(codeLower).toLowerCase(), {
    event: "update",
    type: "updated",
    ts: Date.now(),
    ...payload,
  });
}

function notifyControl(codeLower, payload) {
  if (!codeLower) return;
  publishScreen(String(codeLower).toLowerCase(), {
    event: "control",
    type: "control",
    ts: Date.now(),
    ...payload,
  });
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
      createdByUserId: s.createdByUserId || null,
      createdByUsername: s.createdByUsername || "—",
      createdAt: s.createdAt || null,
      updatedAt: s.updatedAt || null,

      viewCode: s.viewCode || null,
      viewCodeUpdatedAt: s.viewCodeUpdatedAt || null,

      activeSlideId: s.activeSlideId || null, // ✅ added

      settings,

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
  const codeLower = String(screen.viewCodeLower || screen.viewCode || "").toLowerCase();
  const slidesArr = Array.isArray(screen.slides) ? screen.slides : [];

  if (action === "rename") {
    const title = safeStr(body?.title);
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    await db.collection("presentationScreens").updateOne({ _id }, { $set: { title, updatedAt: now } });

    notifyUpdate(codeLower, { action: "rename" });
    return NextResponse.json({ ok: true });
  }

  if (action === "settings") {
    const prev = screen.settings || {};
    const s = body?.settings || {};

    const cardStyle = safeStr(s.cardStyle || prev.cardStyle || "movie");
    const theme = safeStr(s.theme || prev.theme || "aurora");

    if (!["movie", "compact"].includes(cardStyle)) return NextResponse.json({ error: "cardStyle invalid" }, { status: 400 });
    if (!["aurora", "blue", "purple", "emerald"].includes(theme)) return NextResponse.json({ error: "theme invalid" }, { status: 400 });

    const nextSettings = {
      cardStyle,
      theme,
      autoplay: false,
      showControls: true,
      showProgress: false,
    };

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { settings: nextSettings, updatedAt: now } }
    );

    notifyUpdate(codeLower, { action: "settings" });
    return NextResponse.json({ ok: true });
  }

  // ✅ NEW: remote control (mirror prev/next)
  if (action === "control") {
    const cmd = safeStr(body?.cmd).toLowerCase(); // next | prev | set
    if (!["next", "prev", "set"].includes(cmd)) {
      return NextResponse.json({ error: "cmd invalid" }, { status: 400 });
    }

    if (slidesArr.length === 0) {
      await db.collection("presentationScreens").updateOne(
        { _id },
        { $set: { activeSlideId: null, updatedAt: now } }
      );
      notifyControl(codeLower, { cmd, activeSlideId: null });
      notifyUpdate(codeLower, { action: "control" });
      return NextResponse.json({ ok: true, activeSlideId: null });
    }

    let curIdx = -1;
    if (screen.activeSlideId) {
      curIdx = slidesArr.findIndex((s) => s.slideId === screen.activeSlideId);
    }
    if (curIdx < 0) curIdx = 0;

    let nextIdx = curIdx;

    if (cmd === "next") nextIdx = (curIdx + 1) % slidesArr.length;
    if (cmd === "prev") nextIdx = (curIdx - 1 + slidesArr.length) % slidesArr.length;

    if (cmd === "set") {
      const slideId = safeStr(body?.slideId);
      const found = slidesArr.findIndex((s) => s.slideId === slideId);
      if (found >= 0) nextIdx = found;
    }

    const activeSlideId = slidesArr[nextIdx]?.slideId || slidesArr[0]?.slideId || null;

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { activeSlideId, updatedAt: now } }
    );

    // instant mirror
    notifyControl(codeLower, { cmd, activeSlideId });
    // also publish update so non-SSE clients/pollers stay consistent
    notifyUpdate(codeLower, { action: "control" });

    return NextResponse.json({ ok: true, activeSlideId });
  }

  if (action === "setViewCode") {
    const v = validateViewCode5(body?.viewCode);
    if (!v) return NextResponse.json({ error: "Invalid viewCode (exactly 5 chars)" }, { status: 400 });

    try {
      await db.collection("presentationScreens").createIndex({ viewCodeLower: 1 }, { unique: true, sparse: true });
    } catch {}

    const lower = v.toLowerCase();
    const exists = await db.collection("presentationScreens").findOne(
      { viewCodeLower: lower, _id: { $ne: _id } },
      { projection: { _id: 1 } }
    );
    if (exists) return NextResponse.json({ error: "viewCode already used" }, { status: 409 });

    const oldLower = String(screen.viewCodeLower || screen.viewCode || "").toLowerCase();

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { viewCode: v, viewCodeLower: lower, viewCodeUpdatedAt: now, updatedAt: now } }
    );

    if (oldLower) publishScreen(oldLower, { event: "invalidate", type: "codeChanged", newCode: v, ts: Date.now() });
    publishScreen(lower, { event: "update", type: "updated", ts: Date.now(), action: "setViewCode" });

    return NextResponse.json({ ok: true, viewCode: v });
  }

  if (action === "regenViewCode") {
    try {
      await db.collection("presentationScreens").createIndex({ viewCodeLower: 1 }, { unique: true, sparse: true });
    } catch {}

    let viewCode = null;
    for (let i = 0; i < 30; i++) {
      const c = genViewCode5();
      const exists = await db.collection("presentationScreens").findOne(
        { viewCodeLower: c.toLowerCase(), _id: { $ne: _id } },
        { projection: { _id: 1 } }
      );
      if (!exists) { viewCode = c; break; }
    }
    if (!viewCode) return NextResponse.json({ error: "VIEWCODE_ALLOCATE_FAILED" }, { status: 500 });

    const oldLower = String(screen.viewCodeLower || screen.viewCode || "").toLowerCase();
    const newLower = viewCode.toLowerCase();

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { viewCode, viewCodeLower: newLower, viewCodeUpdatedAt: now, updatedAt: now } }
    );

    if (oldLower) publishScreen(oldLower, { event: "invalidate", type: "codeChanged", newCode: viewCode, ts: Date.now() });
    publishScreen(newLower, { event: "update", type: "updated", ts: Date.now(), action: "regenViewCode" });

    return NextResponse.json({ ok: true, viewCode });
  }

  if (action === "addSlide") {
    const kind = safeStr(body?.kind || "SINGLE").toUpperCase();
    const origin = body?.origin || null;

    let ids = [];
    if (Array.isArray(body?.customerIds) && body.customerIds.length) ids = body.customerIds.map(safeStr).filter(Boolean);
    else if (body?.customerId) ids = [safeStr(body.customerId)];

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

    const setObj = { updatedAt: now };
    // if first slide and no activeSlideId, set it
    if (!screen.activeSlideId && slidesArr.length === 0) {
      setObj.activeSlideId = slide.slideId;
    }

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $push: { slides: slide }, $set: setObj }
    );

    notifyUpdate(codeLower, { action: "addSlide", slideId: slide.slideId });

    // if activeSlideId was set, also broadcast control so everyone jumps to it
    if (setObj.activeSlideId) {
      notifyControl(codeLower, { cmd: "set", activeSlideId: setObj.activeSlideId });
    }

    return NextResponse.json({ ok: true, slideId: slide.slideId });
  }

  if (action === "removeSlide") {
    const slideId = safeStr(body?.slideId);
    if (!slideId) return NextResponse.json({ error: "slideId required" }, { status: 400 });

    const remaining = slidesArr.filter((s) => s.slideId !== slideId);
    const nextActive = screen.activeSlideId === slideId ? (remaining[0]?.slideId || null) : (screen.activeSlideId || null);

    await db.collection("presentationScreens").updateOne(
      { _id },
      { $pull: { slides: { slideId } }, $set: { updatedAt: now, activeSlideId: nextActive } }
    );

    notifyUpdate(codeLower, { action: "removeSlide", slideId });
    notifyControl(codeLower, { cmd: "set", activeSlideId: nextActive });

    return NextResponse.json({ ok: true });
  }

  if (action === "clearSlides") {
    await db.collection("presentationScreens").updateOne(
      { _id },
      { $set: { slides: [], activeSlideId: null, updatedAt: now } }
    );

    notifyUpdate(codeLower, { action: "clearSlides" });
    notifyControl(codeLower, { cmd: "set", activeSlideId: null });

    return NextResponse.json({ ok: true });
  }

  if (action === "moveSlide") {
    const slideId = safeStr(body?.slideId);
    const dir = safeStr(body?.dir);
    if (!slideId) return NextResponse.json({ error: "slideId required" }, { status: 400 });
    if (!["up", "down"].includes(dir)) return NextResponse.json({ error: "dir invalid" }, { status: 400 });

    const slides = [...slidesArr];
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

    notifyUpdate(codeLower, { action: "moveSlide", slideId, dir });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { screenId } = await params;
  const body = await req.json().catch(() => ({}));
  const commitMessage = safeStr(body?.commitMessage);

  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  const db = await getDb();
  const _id = new ObjectId(screenId);

  const screen = await db.collection("presentationScreens").findOne({ _id });
  if (!screen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = String(screen.createdByUserId || "") === String(session.userId || "");
  if (!isOwner) return NextResponse.json({ error: "Only screen creator can delete" }, { status: 403 });

  if (screen.viewCodeLower) {
    publishScreen(String(screen.viewCodeLower).toLowerCase(), {
      event: "delete",
      type: "deleted",
      ts: Date.now(),
    });
  }

  await db.collection("presentationScreens").deleteOne({ _id });

  return NextResponse.json({ ok: true });
}
