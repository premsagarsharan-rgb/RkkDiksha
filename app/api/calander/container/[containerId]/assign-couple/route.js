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
  // A, B, C... (fallback M1..)
  const n = i + 1;
  if (n <= 26) return String.fromCharCode(64 + n); // 1->A
  return `M${n}`;
}

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { containerId } = await params;
  const body = await req.json().catch(() => ({}));
  const { customerIds, note, commitMessage } = body || {};

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

  const count = await db.collection("calendarAssignments").countDocuments({
    containerId: ctnId,
    status: "IN_CONTAINER",
  });

  if (count + ids.length > (container.limit || 20)) {
    return NextResponse.json({ error: "HOUSEFULL" }, { status: 409 });
  }

  // all must be ACTIVE sitting
  const customers = await db.collection("sittingCustomers").find({ _id: { $in: ids } }).toArray();
  if (customers.length !== ids.length) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  for (const c of customers) {
    if (c.status !== "ACTIVE") {
      return NextResponse.json({ error: "Customer not ACTIVE (already assigned)" }, { status: 409 });
    }
  }

  // pre-check (unique index also protects)
  const already = await db.collection("calendarAssignments").findOne({
    customerId: { $in: ids },
    status: "IN_CONTAINER",
  });
  if (already) {
    return NextResponse.json({ error: "One of the customers is already assigned to another container" }, { status: 409 });
  }

  const pairId = new ObjectId();
  const kind = ids.length === 2 ? "COUPLE" : "FAMILY";

  // IMPORTANT: stable sequence order -> createdAt increasing by 1ms
  const docs = ids.map((cid, i) => {
    const t = new Date(now.getTime() + i);
    return {
      containerId: ctnId,
      customerId: cid,
      note: String(note || "").trim(),
      status: "IN_CONTAINER",

      kind,              // COUPLE or FAMILY
      pairId,
      roleInPair: roleLabel(i),

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

  // update all customers
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
  };

  // commits for EACH customer
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
