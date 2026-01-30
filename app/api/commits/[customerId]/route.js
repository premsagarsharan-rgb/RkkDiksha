import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { customerId } = await params;
  const db = await getDb();

  const items = await db.collection("customerCommits")
    .find({ customerId: new ObjectId(customerId) })
    .sort({ createdAt: -1 })
    .limit(120)
    .toArray();

  return NextResponse.json({ items });
}
