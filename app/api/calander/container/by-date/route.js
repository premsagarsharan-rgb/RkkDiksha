// app/api/calander/container/by-date/route.js
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { date, mode } = body || {};

  if (!date || !mode) {
    return NextResponse.json({ error: "Missing date/mode" }, { status: 400 });
  }
  if (!["DIKSHA", "MEETING"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const db = await getDb();

  const key = { date, mode };

  await db.collection("calendarContainers").updateOne(
    key,
    {
      $setOnInsert: {
        date,
        mode,
        limit: 20, // Limit A default
        createdByUserId: session.userId,
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );

  const container = await db.collection("calendarContainers").findOne(key);

  if (!container) {
    return NextResponse.json({ error: "Container create failed" }, { status: 500 });
  }

  return NextResponse.json({ container });
}
