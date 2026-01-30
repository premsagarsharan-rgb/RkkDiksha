// app/api/customers/sitting/[id]/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const allowed = ["name", "phone", "gender", "notes"];
  const $set = { updatedAt: new Date() };

  for (const k of allowed) {
    if (body?.[k] !== undefined) {
      $set[k] = typeof body[k] === "string" ? body[k].trim() : body[k];
    }
  }

  if ($set.gender && !["MALE", "FEMALE", "OTHER"].includes($set.gender)) {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }

  const db = await getDb();
  const r = await db.collection("sittingCustomers").updateOne(
    { _id: new ObjectId(id) },
    { $set }
  );

  if (!r.matchedCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
