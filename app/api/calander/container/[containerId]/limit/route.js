import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { containerId } = await params;
  const body = await req.json();
  const inviteLimit = parseInt(body?.limit, 10);

  if (!Number.isFinite(inviteLimit) || inviteLimit < 1) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("calendarContainers").updateOne(
    { _id: new ObjectId(containerId) },
    { $set: { limit: inviteLimit, updatedAt: new Date() } }
  );

  return NextResponse.json({ ok: true });
}
