// app/api/events/[eventId]/invites/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// GET: List all invites for an event
export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const db = await getDb();
  const eId = new ObjectId(eventId);

  const invites = await db
    .collection("eventInvites")
    .aggregate([
      { $match: { eventId: eId, status: "IN_EVENT" } },
      {
        $lookup: {
          from: "sittingCustomers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

  return NextResponse.json({ invites });
}

// POST: Invite customer to event
export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await req.json();
  const { customerId } = body || {};

  if (!customerId) {
    return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
  }

  const db = await getDb();
  const eId = new ObjectId(eventId);
  const cId = new ObjectId(customerId);

  // 1) Event check
  const event = await db.collection("events").findOne({ _id: eId });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // 2) Customer check
  const customer = await db.collection("sittingCustomers").findOne({ _id: cId });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // 3) Rule: Only ACTIVE customers can be invited
  if (customer.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Customer is already in an event or paused" },
      { status: 409 }
    );
  }

  // 4) HARD RULE: Customer 1 time mein sirf 1 hi event mein ho sakta hai
  const existingInvite = await db.collection("eventInvites").findOne({
    customerId: cId,
    status: "IN_EVENT",
  });

  if (existingInvite) {
    return NextResponse.json(
      { error: "This customer is already assigned to another event" },
      { status: 409 }
    );
  }

  // 5) Current event ka invite count (limit)
  const currentCount = await db.collection("eventInvites").countDocuments({
    eventId: eId,
    status: "IN_EVENT",
  });

  // USER role cannot cross limit; ADMIN can increase via /limit API
  if (session.role !== "ADMIN" && currentCount >= event.inviteLimit) {
    return NextResponse.json(
      { error: "Invite limit reached. Ask Admin to increase limit." },
      { status: 403 }
    );
  }

  // 6) Create invite
  await db.collection("eventInvites").insertOne({
    eventId: eId,
    customerId: cId,
    status: "IN_EVENT",
    addedByUserId: session.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 7) Update customer status in Sitting DB
  await db.collection("sittingCustomers").updateOne(
    { _id: cId },
    { $set: { status: "IN_EVENT", activeEventId: eId } }
  );

  return NextResponse.json({ ok: true });
}
