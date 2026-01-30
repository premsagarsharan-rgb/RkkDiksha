import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { containerId } = await params;
  const body = await req.json().catch(() => ({}));
  const { customerId, source, note, commitMessage } = body || {};

  if (!customerId || !source) return NextResponse.json({ error: "Missing customerId/source" }, { status: 400 });
  if (!["TODAY", "PENDING", "SITTING"].includes(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }
  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  const db = await getDb();
  const ctnId = new ObjectId(containerId);
  const custId = new ObjectId(customerId);
  const actorLabel = `${session.role}:${session.username}`;
  const now = new Date();

  const container = await db.collection("calendarContainers").findOne({ _id: ctnId });
  if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

  // Housefull check
  const count = await db.collection("calendarAssignments").countDocuments({
    containerId: ctnId,
    status: "IN_CONTAINER",
  });

  if (count >= (container.limit || 20)) {
    return NextResponse.json({ error: "HOUSEFULL" }, { status: 409 });
  }

  // Move TODAY/PENDING -> sittingCustomers (keep same _id) then delete source
  if (source === "TODAY") {
    const doc = await db.collection("todayCustomers").findOne({ _id: custId });
    if (!doc) return NextResponse.json({ error: "Customer not found in Recent" }, { status: 404 });

    try {
      await db.collection("sittingCustomers").insertOne({
        ...doc,
        _id: custId,
        status: "ACTIVE",
        activeContainerId: null,
        verifiedByUserId: session.userId,
        verifiedAt: now,
      });
    } catch (e) {
      if (String(e?.code) === "11000") {
        return NextResponse.json({ error: "Customer already exists in Sitting DB" }, { status: 409 });
      }
      return NextResponse.json({ error: "Move to sitting failed" }, { status: 500 });
    }

    await db.collection("todayCustomers").deleteOne({ _id: custId });
  }

  if (source === "PENDING") {
    const doc = await db.collection("pendingCustomers").findOne({ _id: custId });
    if (!doc) return NextResponse.json({ error: "Customer not found in Pending" }, { status: 404 });

    try {
      await db.collection("sittingCustomers").insertOne({
        ...doc,
        _id: custId,
        status: "ACTIVE",
        activeContainerId: null,
        verifiedByUserId: session.userId,
        verifiedAt: now,
      });
    } catch (e) {
      if (String(e?.code) === "11000") {
        return NextResponse.json({ error: "Customer already exists in Sitting DB" }, { status: 409 });
      }
      return NextResponse.json({ error: "Move to sitting failed" }, { status: 500 });
    }

    await db.collection("pendingCustomers").deleteOne({ _id: custId });
  }

  // Must be ACTIVE in sitting
  const sitting = await db.collection("sittingCustomers").findOne({ _id: custId });
  if (!sitting) return NextResponse.json({ error: "Customer not found in Sitting" }, { status: 404 });
  if (sitting.status !== "ACTIVE") {
    return NextResponse.json({ error: "Customer not ACTIVE (already assigned)" }, { status: 409 });
  }

  // Insert assignment (unique partial index will also protect multi-container)
  try {
    await db.collection("calendarAssignments").insertOne({
      containerId: ctnId,
      customerId: custId,
      note: String(note || "").trim(),
      status: "IN_CONTAINER",

      // IMPORTANT fields
      kind: "SINGLE",
      pairId: null,
      roleInPair: null,

      addedByUserId: session.userId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    if (String(e?.code) === "11000") {
      return NextResponse.json({ error: "Customer already assigned to another container" }, { status: 409 });
    }
    return NextResponse.json({ error: "Assign failed" }, { status: 500 });
  }

  // Update customer state
  await db.collection("sittingCustomers").updateOne(
    { _id: custId },
    { $set: { status: "IN_EVENT", activeContainerId: ctnId } }
  );

  // Commit (single)
  await addCommit({
    customerId: custId,
    userId: session.userId,
    actorLabel,
    message: commitMessage,
    action: "ASSIGN_SINGLE",
    meta: { containerId: String(ctnId), date: container.date, mode: container.mode },
  });

  return NextResponse.json({ ok: true });
}
