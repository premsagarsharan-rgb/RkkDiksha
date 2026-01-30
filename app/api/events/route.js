// app/api/events/route.js
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const query = {};
  if (from && to) {
    query.date = { $gte: from, $lte: to };
  }

  const db = await getDb();
  const items = await db
    .collection("events")
    .find(query)
    .sort({ date: 1, startTime: 1 })
    .toArray();

  return NextResponse.json({ items });
}

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  let { title, date, startTime, endTime, type } = body || {};

  if (!title || !date || !startTime || !endTime || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  type = type.toUpperCase();
  if (!["NORMAL", "COUPLE"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const defaultLimit = type === "COUPLE" ? 10 : 20;

  const db = await getDb();
  const doc = {
    title,
    date,       // "YYYY-MM-DD"
    startTime,  // "HH:mm"
    endTime,    // "HH:mm"
    type,
    inviteLimit: defaultLimit,
    createdByUserId: session.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const r = await db.collection("events").insertOne(doc);
  return NextResponse.json({ ok: true, id: String(r.insertedId) });
}
