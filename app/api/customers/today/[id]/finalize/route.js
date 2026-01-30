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

  // basic sanitize
  merged.name = String(merged.name || "").trim();
  merged.age = String(merged.age || "").trim();
  merged.address = String(merged.address || "").trim();
  merged.pincode = String(merged.pincode || "").trim();

  // ✅ RollNo: keep same but Sitting me "S" suffix
  const rollNoBase = String(merged.rollNo ?? "").trim().replace(/S$/i, "");
  const rollNoSitting = rollNoBase ? `${rollNoBase}S` : "S";

  // Move to sitting
  await db.collection("sittingCustomers").insertOne({
    ...merged,
    _id,

    rollNoBase,          // NEW (original)
    rollNo: rollNoSitting, // UPDATED (with S)

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
    meta: { rollNo: rollNoSitting, rollNoBase: rollNoBase || null },
  });

  return NextResponse.json({ ok: true });
}
