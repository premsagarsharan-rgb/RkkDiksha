// app/api/events/[eventId]/limit/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { inviteLimit } = body || {};
  if (!Number.isInteger(inviteLimit) || inviteLimit < 1) {
    return NextResponse.json({ error: "Invalid inviteLimit" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("events").updateOne(
    { _id: new ObjectId(params.eventId) },
    { $set: { inviteLimit, updatedAt: new Date() } }
  );

  return NextResponse.json({ ok: true });
}
