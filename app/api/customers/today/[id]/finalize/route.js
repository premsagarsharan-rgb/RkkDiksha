import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { updates, commitMessage } = body || {};

  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  const db = await getDb();
  const _id = new ObjectId(id);

  const today = await db.collection("todayCustomers").findOne({ _id });
  if (!today) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Merge updates (final form data)
  const merged = { ...today, ...(updates || {}) };

  // ✅ IMPORTANT: RollNo lifetime unique => never modify, never suffix
  // also protect against client sending rollNo in updates
  merged.rollNo = today.rollNo;
  merged.rollSeq = today.rollSeq;

  // basic sanitize
  merged.name = String(merged.name || "").trim();
  merged.age = String(merged.age || "").trim();
  merged.address = String(merged.address || "").trim();
  merged.pincode = String(merged.pincode || "").trim();

  merged.country = String(merged.country || "").trim();
  merged.state = String(merged.state || "").trim();
  merged.city = String(merged.city || "").trim();

  // Move to sitting (same _id)
  await db.collection("sittingCustomers").insertOne({
    ...merged,
    _id,

    // ✅ keep same rollNo everywhere
    rollNo: merged.rollNo,
    rollSeq: merged.rollSeq,

    status: "ACTIVE",
    activeContainerId: null,
    verifiedByUserId: session.userId,
    verifiedAt: new Date(),
    finalizedAt: new Date(),
  });

  await db.collection("todayCustomers").deleteOne({ _id });

  const actorLabel = `${session.role}:${session.username}`;

  await addCommit({
    customerId: _id,
    userId: session.userId,
    actorLabel,
    message: commitMessage,
    action: "FINALIZE_TO_SITTING",
    meta: {
      rollNo: merged.rollNo || null,
      rollSeq: merged.rollSeq || null,
    },
  });

  return NextResponse.json({ ok: true, rollNo: merged.rollNo || null });
}
