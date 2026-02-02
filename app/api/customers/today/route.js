import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// IST date key: "YYYY-MM-DD" (Recent list ke liye)
function getISTDateKey(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatRollNo(seq) {
  // ✅ Your requested format: A01, A02, ...
  return `A${pad2(seq)}`;
}

function normalizeRollQuery(q) {
  const s = String(q || "").trim().toUpperCase();
  if (!s) return null;

  // allow: "A01", "a1", "1"
  const m = s.match(/^A?(\d+)$/);
  if (!m) return null;

  const num = parseInt(m[1], 10);
  if (!Number.isFinite(num) || num < 0) return null;

  return { rollSeq: num, rollNo: formatRollNo(num) };
}

async function ensureIndexes(db) {
  // submissionId dedupe
  try {
    await db.collection("todayCustomers").createIndex({ submissionId: 1 }, { unique: true });
  } catch {}

  // ✅ for faster search / sorting (NOT unique, because existing old data may have duplicates)
  try {
    await db.collection("todayCustomers").createIndex({ rollNo: 1 });
  } catch {}
  try {
    await db.collection("todayCustomers").createIndex({ rollSeq: 1 });
  } catch {}
  try {
    await db.collection("todayCustomers").createIndex({ rollDate: 1 });
  } catch {}

  // ✅ global roll counter doc
  try {
    await db.collection("globalRollCounters").createIndex({ _id: 1 }, { unique: true });
  } catch {}
}

async function allocateGlobalRoll(db) {
  // Atomic increment (race-safe)
  const r = await db.collection("globalRollCounters").findOneAndUpdate(
    { _id: "CUSTOMER_ROLL_A" },
    {
      $inc: { seq: 1 },
      $setOnInsert: { createdAt: new Date() },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, returnDocument: "after" }
  );

  const doc = r?.value || r;
  const seq = doc?.seq;

  if (!Number.isInteger(seq) || seq < 1) return null;

  return { rollSeq: seq, rollNo: formatRollNo(seq) };
}

export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const db = await getDb();
  await ensureIndexes(db);

  // Default: Recent = only today's entries
  const rollDate = getISTDateKey();
  const filter = { rollDate };

  if (q) {
    const or = [];
    const roll = normalizeRollQuery(q);

    if (roll) {
      // exact match by rollNo (A01) or rollSeq (1)
      or.push({ rollNo: roll.rollNo });
      or.push({ rollSeq: roll.rollSeq });
    }

    const rx = new RegExp(escapeRegex(q), "i");
    or.push({ name: rx });
    or.push({ address: rx });
    or.push({ city: rx });
    or.push({ state: rx });
    or.push({ country: rx });
    or.push({ remarks: rx });
    or.push({ pincode: rx }); // older docs compatibility

    filter.$or = or;
  }

  const items = await db
    .collection("todayCustomers")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(80)
    .toArray();

  return NextResponse.json({ items });
}

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const {
    submissionId,
    commitMessage,

    // basic
    name,
    age,
    gender = "OTHER",

    // address (old + new)
    address,
    country,
    state,
    city,

    // new fields
    occupation,
    note,
    approver,
    maritalStatus,
    remarks,
    remarksBy,

    // family permission
    familyPermission,
    familyPermissionRelation,
    familyPermissionOther,

    // legacy optional fields
    followYears,
    clubVisitsBefore,
    monthYear,
    onionGarlic,
    hasPet,
    hadTeacherBefore,
    pincode,
  } = body || {};

  if (!submissionId) return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  if (!name || !age) {
    return NextResponse.json({ error: "Missing required fields (name, age)" }, { status: 400 });
  }

  if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }

  const db = await getDb();
  await ensureIndexes(db);

  // submissionId dedupe
  const existing = await db.collection("todayCustomers").findOne({ submissionId });
  if (existing) {
    return NextResponse.json({
      ok: true,
      deduped: true,
      id: String(existing._id),
      rollNo: existing.rollNo ?? null,
      rollSeq: existing.rollSeq ?? null,
      rollDate: existing.rollDate ?? null,
    });
  }

  // ✅ lifetime unique roll (no daily reset)
  const roll = await allocateGlobalRoll(db);
  if (!roll) return NextResponse.json({ error: "ROLL_ALLOCATE_FAILED" }, { status: 500 });

  const rollDate = getISTDateKey();
  const now = new Date();

  // address fallback (if not sent)
  const computedAddress =
    String(address || "").trim() ||
    [city, state, country || "India"].map((x) => String(x || "").trim()).filter(Boolean).join(", ");

  if (!computedAddress) {
    return NextResponse.json({ error: "Missing address (country/state/city or address)" }, { status: 400 });
  }

  const doc = {
    submissionId,

    // ✅ global unique roll
    rollNo: roll.rollNo,     // "A01"
    rollSeq: roll.rollSeq,   // 1
    rollDate,                // only for "Recent(today)" filtering

    name: String(name).trim(),
    age: String(age).trim(),
    gender,

    // new structured address
    country: String(country || "India").trim() || "India",
    state: String(state || "").trim(),
    city: String(city || "").trim(),

    // compatibility address
    address: computedAddress,

    occupation: String(occupation || "").trim(),
    note: String(note || "").trim(),
    approver: String(approver || "").trim(),
    maritalStatus: String(maritalStatus || "").trim(),

    // remarks (auto user/admin)
    remarks: String(remarks || remarksBy || session.username || "").trim(),
    remarksBy: String(remarksBy || session.username || "").trim(),

    familyPermission: !!familyPermission,
    familyPermissionRelation: String(familyPermissionRelation || "").trim(),
    familyPermissionOther: String(familyPermissionOther || "").trim(),

    followYears: String(followYears || "").trim(),
    clubVisitsBefore: String(clubVisitsBefore || "").trim(),
    monthYear: String(monthYear || "").trim(),
    onionGarlic: !!onionGarlic,
    hasPet: !!hasPet,
    hadTeacherBefore: !!hadTeacherBefore,

    pincode: String(pincode || "").trim(), // legacy

    status: "RECENT",
    source: "MANUAL",
    createdByUserId: session.userId,
    createdAt: now,
  };

  try {
    const r = await db.collection("todayCustomers").insertOne(doc);

    const actorLabel = `${session.role}:${session.username}`;

    await addCommit({
      customerId: r.insertedId,
      userId: session.userId,
      actorLabel,
      message: commitMessage,
      action: "CREATE_RECENT",
      meta: { source: doc.source, rollNo: doc.rollNo, rollSeq: doc.rollSeq },
    });

    return NextResponse.json({ ok: true, id: String(r.insertedId), rollNo: doc.rollNo, rollSeq: doc.rollSeq, rollDate });
  } catch (e) {
    if (String(e?.code) === "11000") {
      return NextResponse.json({ error: "DUPLICATE (submissionId)" }, { status: 409 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
