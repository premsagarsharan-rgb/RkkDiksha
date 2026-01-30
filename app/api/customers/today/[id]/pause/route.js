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
  const commitMessage = body?.commitMessage;

  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  const db = await getDb();
  const _id = new ObjectId(id);

  const customer = await db.collection("todayCustomers").findOne({ _id });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.collection("pendingCustomers").insertOne({
    ...customer,
    _id,
    status: "PENDING",
    movedAt: new Date(),
    movedByUserId: session.userId,
  });

  await db.collection("todayCustomers").deleteOne({ _id });

  await addCommit({
    customerId: _id,
    userId: session.userId,
    message: commitMessage,
    action: "PAUSE_TO_PENDING",
  });

  return NextResponse.json({ ok: true });
}
