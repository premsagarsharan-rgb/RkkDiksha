import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const commitMessage = body?.commitMessage;

  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  const allowed = [
    "name","age","address","followYears","clubVisitsBefore","monthYear",
    "onionGarlic","hasPet","hadTeacherBefore","familyPermission",
    "gender","country","state","city","pincode"
  ];

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
  const _id = new ObjectId(id);

  const r = await db.collection("todayCustomers").updateOne({ _id }, { $set });
  if (!r.matchedCount) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await addCommit({
    customerId: _id,
    userId: session.userId,
    message: commitMessage,
    action: "EDIT_PROFILE",
    meta: { fields: Object.keys($set).filter(k => k !== "updatedAt") },
  });

  return NextResponse.json({ ok: true });
}
