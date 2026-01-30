import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const items = await db.collection("pendingCustomers")
    .find({})
    .sort({ movedAt: -1, createdAt: -1 })
    .limit(120)
    .toArray();

  return NextResponse.json({ items });
}
