import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

function isDateKey(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function countReservedForContainer(db, dikshaContainerId) {
  return db.collection("calendarAssignments").countDocuments({
    occupiedContainerId: dikshaContainerId,
    meetingDecision: "PENDING",
    status: "IN_CONTAINER",
  });
}

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { containerId } = await params;
  const body = await req.json().catch(() => ({}));
  const { customerId, source, note, commitMessage, occupyDate } = body || {};

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

  // capacity check for this container
  const inCount = await db.collection("calendarAssignments").countDocuments({
    containerId: ctnId,
    status: "IN_CONTAINER",
  });

  // ✅ DIKSHA mode: reserved also consumes limit
  if (container.mode === "DIKSHA") {
    const reservedCount = await countReservedForContainer(db, ctnId);
    const used = inCount + reservedCount;
    if (used >= (container.limit || 20)) {
      return NextResponse.json({ error: "HOUSEFULL" }, { status: 409 });
    }
  } else {
    // meeting or others: normal limit
    if (inCount >= (container.limit || 20)) {
      return NextResponse.json({ error: "HOUSEFULL" }, { status: 409 });
    }
  }

  // ✅ MEETING occupy validation + DIKSHA capacity check
  let occupiedContainerId = null;
  let occupiedMode = null;
  let occupiedDate = null;
  let meetingDecision = null;

  if (occupyDate != null) {
    if (container.mode !== "MEETING") {
      return NextResponse.json({ error: "occupyDate only allowed for MEETING containers" }, { status: 400 });
    }
    if (!isDateKey(occupyDate)) return NextResponse.json({ error: "Invalid occupyDate (YYYY-MM-DD)" }, { status: 400 });

    const todayKey = ymdLocal(new Date());
    if (occupyDate <= todayKey) {
      return NextResponse.json({ error: "occupyDate must be future date" }, { status: 400 });
    }

    // ensure DIKSHA container exists
    const key = { date: occupyDate, mode: "DIKSHA" };
    await db.collection("calendarContainers").updateOne(
      key,
      {
        $setOnInsert: {
          date: occupyDate,
          mode: "DIKSHA",
          limit: 20,
          createdByUserId: session.userId,
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true }
    );

    const dikshaContainer = await db.collection("calendarContainers").findOne(key);
    if (!dikshaContainer?._id) return NextResponse.json({ error: "Diksha container create failed" }, { status: 500 });

    // ✅ occupied consumes DIKSHA limit too (IN_CONTAINER + RESERVED + 1 <= limit)
    const dikshaIn = await db.collection("calendarAssignments").countDocuments({
      containerId: dikshaContainer._id,
      status: "IN_CONTAINER",
    });
    const dikshaReserved = await countReservedForContainer(db, dikshaContainer._id);
    const dikshaUsed = dikshaIn + dikshaReserved;

    if (dikshaUsed + 1 > (dikshaContainer.limit || 20)) {
      return NextResponse.json({ error: "HOUSEFULL" }, { status: 409 });
    }

    occupiedContainerId = dikshaContainer._id;
    occupiedMode = "DIKSHA";
    occupiedDate = occupyDate;
    meetingDecision = "PENDING";
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
      if (String(e?.code) === "11000") return NextResponse.json({ error: "Customer already exists in Sitting DB" }, { status: 409 });
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
      if (String(e?.code) === "11000") return NextResponse.json({ error: "Customer already exists in Sitting DB" }, { status: 409 });
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

  // Insert assignment
  try {
    await db.collection("calendarAssignments").insertOne({
      containerId: ctnId,
      customerId: custId,
      note: String(note || "").trim(),
      status: "IN_CONTAINER",

      kind: "SINGLE",
      pairId: null,
      roleInPair: null,

      occupiedMode,
      occupiedDate,
      occupiedContainerId,
      meetingDecision,

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

  await db.collection("sittingCustomers").updateOne(
    { _id: custId },
    { $set: { status: "IN_EVENT", activeContainerId: ctnId } }
  );

  await addCommit({
    customerId: custId,
    userId: session.userId,
    actorLabel,
    message: commitMessage,
    action: "ASSIGN_SINGLE",
    meta: {
      containerId: String(ctnId),
      date: container.date,
      mode: container.mode,
      occupiedDate,
      occupiedMode,
      occupiedContainerId: occupiedContainerId ? String(occupiedContainerId) : null,
      meetingDecision,
    },
  });

  return NextResponse.json({ ok: true });
}
