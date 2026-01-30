import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// IST date key: "YYYY-MM-DD"
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

async function ensureTodayIndexes(db) {
  // submissionId dedupe (double-click protection)
  try {
    await db.collection("todayCustomers").createIndex({ submissionId: 1 }, { unique: true });
  } catch {}

  // roll number unique per day
  try {
    await db.collection("todayCustomers").createIndex(
      { rollDate: 1, rollNo: 1 },
      { unique: true }
    );
  } catch {}

  // counter unique per day
  try {
    await db.collection("dailyRollCounters").createIndex({ rollDate: 1 }, { unique: true });
  } catch {}
}

async function allocateDailyRollNo(db, rollDate) {
  // Atomic increment (race-safe)
  const r = await db.collection("dailyRollCounters").findOneAndUpdate(
    { rollDate },
    {
      $inc: { seq: 1 },
      $setOnInsert: { rollDate, createdAt: new Date() },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, returnDocument: "after" }
  );

  const doc = r?.value || r;
  const seq = doc?.seq;

  if (!Number.isInteger(seq)) return null;

  // OPTIONAL: daily limit (tumhara old system 1..500 tha)
  // Agar tum daily unlimited chahte ho to ye block hata dena.
  if (seq > 500) return "ROLL_LIMIT_REACHED";

  return seq;
}

export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const db = await getDb();

  // ✅ Default: only today's recent customers
  const rollDate = getISTDateKey();
  const filter = { rollDate };

  if (q) {
    const or = [];
    const num = Number(q);
    if (Number.isInteger(num)) or.push({ rollNo: num });

    const rx = new RegExp(escapeRegex(q), "i");
    or.push({ name: rx });
    or.push({ pincode: rx });

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

  const body = await req.json();

  const {
    submissionId,
    commitMessage,

    name,
    age,
    address,
    followYears,
    clubVisitsBefore,
    monthYear,
    onionGarlic,
    hasPet,
    hadTeacherBefore,
    familyPermission,
    gender = "OTHER",

    pincode,
  } = body || {};

  if (!submissionId) return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  if (!name || !age || !address) {
    return NextResponse.json({ error: "Missing required fields (name, age, address)" }, { status: 400 });
  }

  if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }

  const db = await getDb();
  await ensureTodayIndexes(db);

  // ✅ submissionId dedupe: agar same submissionId already hai to wahi return
  const existing = await db.collection("todayCustomers").findOne({ submissionId });
  if (existing) {
    return NextResponse.json({
      ok: true,
      deduped: true,
      id: String(existing._id),
      rollNo: existing.rollNo ?? null,
      rollDate: existing.rollDate ?? null,
    });
  }

  const rollDate = getISTDateKey();

  // ✅ daily roll no allocate
  const rollNo = await allocateDailyRollNo(db, rollDate);
  if (!rollNo) return NextResponse.json({ error: "ROLL_ALLOCATE_FAILED" }, { status: 500 });
  if (rollNo === "ROLL_LIMIT_REACHED") {
    return NextResponse.json({ error: "ROLL_LIMIT_REACHED (1..500 per day)" }, { status: 409 });
  }

  const doc = {
    submissionId,

    rollDate, // ✅ important for daily uniqueness
    rollNo,   // ✅ 1..n daily

    name: String(name).trim(),
    age: String(age).trim(),
    address: String(address).trim(),
    followYears: String(followYears || "").trim(),
    clubVisitsBefore: String(clubVisitsBefore || "").trim(),
    monthYear: String(monthYear || "").trim(),
    onionGarlic: !!onionGarlic,
    hasPet: !!hasPet,
    hadTeacherBefore: !!hadTeacherBefore,
    familyPermission: !!familyPermission,
    gender,

    pincode: String(pincode || "").trim(),

    status: "RECENT",
    source: "MANUAL",
    createdByUserId: session.userId,
    createdAt: new Date(),
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
      meta: { source: doc.source, rollNo, rollDate },
    });

    return NextResponse.json({ ok: true, id: String(r.insertedId), rollNo, rollDate });
  } catch (e) {
    // If indexes hit duplicate (rare race), show meaningful error
    if (String(e?.code) === "11000") {
      return NextResponse.json({ error: "DUPLICATE (submissionId/rollNo)" }, { status: 409 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
