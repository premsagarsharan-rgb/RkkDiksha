// app/api/customers/sitting/route.js
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// GET: list sitting customers
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const items = await db
    .collection("sittingCustomers")
    .find({})
    .sort({ verifiedAt: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json({ items });
}

// POST: create directly into Sitting DB (Manual Confirm flow)
export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, gender, notes } = body || {};

  if (!name || !phone || !gender) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }

  const db = await getDb();
  const doc = {
    name: String(name).trim(),
    phone: String(phone).trim(),
    gender,
    notes: String(notes || "").trim(),
    status: "ACTIVE",
    activeEventId: null,
    verifiedByUserId: session.userId,
    verifiedAt: new Date(),
    createdAt: new Date(),
    source: "MANUAL_DIRECT",
  };

  const r = await db.collection("sittingCustomers").insertOne(doc);
  return NextResponse.json({ ok: true, id: String(r.insertedId) });
}
