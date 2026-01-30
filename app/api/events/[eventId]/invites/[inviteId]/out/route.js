// app/api/events/[eventId]/invites/[inviteId]/out/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, inviteId } = params;
  if (!eventId || !inviteId) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  const db = await getDb();
  const eid = new ObjectId(eventId);
  const iid = new ObjectId(inviteId);

  const invite = await db.collection("eventInvites").findOne({
    _id: iid,
    eventId: eid,
  });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  if (invite.status !== "IN_EVENT") {
    return NextResponse.json({ error: "Already out" }, { status: 400 });
  }

  await db.collection("eventInvites").updateOne(
    { _id: iid },
    { $set: { status: "OUT", updatedAt: new Date() } }
  );

  await db.collection("sittingCustomers").updateOne(
    { _id: invite.customerId },
    { $set: { status: "ACTIVE", activeEventId: null } }
  );

  return NextResponse.json({ ok: true });
}
