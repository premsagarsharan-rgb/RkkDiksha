// app/api/customers/sitting/[id]/out/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const customerId = new ObjectId(id);

  // find active invite for this customer
  const invite = await db.collection("eventInvites").findOne({
    customerId,
    status: "IN_EVENT",
  });

  if (!invite) {
    return NextResponse.json({ error: "Customer is not in any active event" }, { status: 409 });
  }

  await db.collection("eventInvites").updateOne(
    { _id: invite._id },
    { $set: { status: "OUT", updatedAt: new Date() } }
  );

  await db.collection("sittingCustomers").updateOne(
    { _id: customerId },
    { $set: { status: "ACTIVE", activeEventId: null } }
  );

  return NextResponse.json({ ok: true });
}
