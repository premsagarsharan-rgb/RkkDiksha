import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

function uniq(arr) {
  return Array.from(new Set(arr.map(String)));
}
function roleLabel(i) {
  const n = i + 1;
  if (n <= 26) return String.fromCharCode(64 + n);
  return `M${n}`;
}
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
  const { customerIds, note, commitMessage, occupyDate } = body || {};

  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });
  if (!Array.isArray(customerIds) || customerIds.length < 2) {
    return NextResponse.json({ error: "customerIds must be array (min 2)" }, { status: 400 });
  }

  const cleaned = uniq(customerIds).filter(Boolean);
  if (cleaned.length !== customerIds.length) {
    return NextResponse.json({ error: "Duplicate customers not allowed" }, { status: 400 });
  }

  const db = await getDb();
  const ctnId = new ObjectId(containerId);
  const ids = cleaned.map((x) => new ObjectId(x));

  const actorLabel = `${session.role}:${session.username}`;
  const now = new Date();

  const container = await db.collection("calendarContainers").findOne({ _id: ctnId });
  if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

  // capacity check for this container
  const inCount = await db.collection("calendarAssignments").countDocuments({
    containerId: ctnId,
    status: "IN_CONTAINER",
  });

  if (container.mode === "DIKSHA") {
    const reservedCount = await countReservedForContainer(db, ctnId);
    const used = inCount + reservedCount;
    if (used + ids.length > (container.limit || 20)) {
      return NextResponse.json({ error: "HOUSEFULL" }, { status: 409 });
    }
  } else {
    if (inCount + ids.length > (container.limit || 20)) {
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
    if (occupyDate <= todayKey) return NextResponse.json({ error: "occupyDate must be future date" }, { status: 400 });

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

    const dikshaIn = await db.collection("calendarAssignments").countDocuments({
      containerId: dikshaContainer._id,
      status: "IN_CONTAINER",
    });
    const dikshaReserved = await countReservedForContainer(db, dikshaContainer._id);
    const dikshaUsed = dikshaIn + dikshaReserved;

    if (dikshaUsed + ids.length > (dikshaContainer.limit || 20)) {
      return NextResponse.json({ error: "HOUSEFULL" }, { status: 409 });
    }

    occupiedContainerId = dikshaContainer._id;
    occupiedMode = "DIKSHA";
    occupiedDate = occupyDate;
    meetingDecision = "PENDING";
  }

  // all must be ACTIVE sitting
  const customers = await db.collection("sittingCustomers").find({ _id: { $in: ids } }).toArray();
  if (customers.length !== ids.length) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  for (const c of customers) {
    if (c.status !== "ACTIVE") {
      return NextResponse.json({ error: "Customer not ACTIVE (already assigned)" }, { status: 409 });
    }
  }

  const already = await db.collection("calendarAssignments").findOne({
    customerId: { $in: ids },
    status: "IN_CONTAINER",
  });
  if (already) {
    return NextResponse.json({ error: "One of the customers is already assigned to another container" }, { status: 409 });
  }

  const pairId = new ObjectId();
  const kind = ids.length === 2 ? "COUPLE" : "FAMILY";

  const docs = ids.map((cid, i) => {
    const t = new Date(now.getTime() + i);
    return {
      containerId: ctnId,
      customerId: cid,
      note: String(note || "").trim(),
      status: "IN_CONTAINER",

      kind,
      pairId,
      roleInPair: roleLabel(i),

      occupiedMode,
      occupiedDate,
      occupiedContainerId,
      meetingDecision,

      addedByUserId: session.userId,
      createdAt: t,
      updatedAt: t,
    };
  });

  try {
    await db.collection("calendarAssignments").insertMany(docs, { ordered: true });
  } catch (e) {
    if (String(e?.code) === "11000") {
      return NextResponse.json({ error: "Customer already assigned (unique rule)" }, { status: 409 });
    }
    return NextResponse.json({ error: `${kind} assign failed` }, { status: 500 });
  }

  await db.collection("sittingCustomers").updateMany(
    { _id: { $in: ids } },
    { $set: { status: "IN_EVENT", activeContainerId: ctnId } }
  );

  const meta = {
    containerId: String(ctnId),
    date: container.date,
    mode: container.mode,
    pairId: String(pairId),
    kind,
    groupSize: ids.length,
    customerIds: ids.map(String),

    occupiedDate,
    occupiedMode,
    occupiedContainerId: occupiedContainerId ? String(occupiedContainerId) : null,
    meetingDecision,
  };

  const action = kind === "FAMILY" ? "ASSIGN_FAMILY" : "ASSIGN_COUPLE";
  for (const cid of ids) {
    await addCommit({
      customerId: cid,
      userId: session.userId,
      actorLabel,
      message: commitMessage,
      action,
      meta,
    });
  }

  return NextResponse.json({ ok: true, pairId: String(pairId), kind, groupSize: ids.length });
}
