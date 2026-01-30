import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const _id = new ObjectId(params.id);

  const today = await db.collection("todayCustomers").findOne({ _id });
  if (!today) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // move to sitting
  const sittingDoc = {
    name: today.name,
    phone: today.phone,
    gender: today.gender,
    notes: today.notes || "",
    status: "ACTIVE",
    verifiedByUserId: session.userId,
    verifiedAt: new Date(),
    createdAt: today.createdAt || new Date(),
  };

  await db.collection("sittingCustomers").insertOne(sittingDoc);
  await db.collection("todayCustomers").deleteOne({ _id });

  return NextResponse.json({ ok: true });
}
