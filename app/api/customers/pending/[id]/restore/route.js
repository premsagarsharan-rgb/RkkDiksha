// app/api/customers/pending/[id]/restore/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

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
    await db.collection("todayCustomers").createIndex({ rollDate: 1, rollNo: 1 }, { unique: true });
  } catch {}

  // counter unique per day
  try {
    await db.collection("dailyRollCounters").createIndex({ rollDate: 1 }, { unique: true });
  } catch {}
}

async function allocateDailyRollNo(db, rollDate) {
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
  if (seq > 500) return "ROLL_LIMIT_REACHED"; // daily limit same as your earlier pool (optional)
  return seq;
}

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const commitMessage = body?.commitMessage;

  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  const db = await getDb();
  await ensureTodayIndexes(db);

  const _id = new ObjectId(id);

  const pending = await db.collection("pendingCustomers").findOne({ _id });
  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const submissionId = pending.submissionId || `legacy_${String(_id)}`;

  // ✅ If already restored (by id or submissionId), just cleanup pending + return ok
  const alreadyById = await db.collection("todayCustomers").findOne({ _id });
  if (alreadyById) {
    await db.collection("pendingCustomers").deleteOne({ _id });
    return NextResponse.json({
      ok: true,
      deduped: true,
      id: String(alreadyById._id),
      rollNo: alreadyById.rollNo ?? null,
      rollDate: alreadyById.rollDate ?? null,
    });
  }

  const alreadyBySubmission = await db.collection("todayCustomers").findOne({ submissionId });
  if (alreadyBySubmission) {
    await db.collection("pendingCustomers").deleteOne({ _id });
    return NextResponse.json({
      ok: true,
      deduped: true,
      id: String(alreadyBySubmission._id),
      rollNo: alreadyBySubmission.rollNo ?? null,
      rollDate: alreadyBySubmission.rollDate ?? null,
    });
  }

  const rollDate = getISTDateKey();

  // Try insert with roll allocation (retry on rare rollNo collision)
  let lastErr = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const rollNo = await allocateDailyRollNo(db, rollDate);
    if (!rollNo) return NextResponse.json({ error: "ROLL_ALLOCATE_FAILED" }, { status: 500 });
    if (rollNo === "ROLL_LIMIT_REACHED") {
      return NextResponse.json({ error: "ROLL_LIMIT_REACHED (1..500 per day)" }, { status: 409 });
    }

    const originalCreatedAt = pending.createdAt || null;

    const doc = {
      ...pending,
      _id,
      submissionId,

      // ✅ override to match new daily system
      rollDate,
      rollNo,

      status: "RECENT",

      // keep history (additive)
      originalCreatedAt,
      createdAt: new Date(), // so restored item comes to top in Recent
      restoredAt: new Date(),
      restoredByUserId: session.userId,
    };

    // Important: remove fields that belong to pending state if you store any (optional)
    // (we are NOT deleting unknown fields; only overriding the required ones)

    try {
      await db.collection("todayCustomers").insertOne(doc);

      await db.collection("pendingCustomers").deleteOne({ _id });

      const actorLabel = `${session.role}:${session.username}`;

      await addCommit({
        customerId: _id,
        userId: session.userId,
        actorLabel,
        message: commitMessage,
        action: "RESTORE_FROM_PENDING",
        meta: { rollNo, rollDate },
      });

      return NextResponse.json({ ok: true, id: String(_id), rollNo, rollDate });
    } catch (e) {
      lastErr = e;
      if (String(e?.code) === "11000") {
        // Duplicate (submissionId/rollNo/_id). If rollNo collided, retry.
        continue;
      }
      return NextResponse.json({ error: "Restore failed" }, { status: 500 });
    }
  }

  // If still failing after retries
  if (String(lastErr?.code) === "11000") {
    return NextResponse.json({ error: "DUPLICATE (restore collision)" }, { status: 409 });
  }

  return NextResponse.json({ error: "Restore failed" }, { status: 500 });
}
