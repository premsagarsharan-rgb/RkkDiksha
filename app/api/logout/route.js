import { NextResponse } from "next/server";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession, clearSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

function sha256(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest("hex");
}

export async function POST() {
  const session = await getSession();

  if (session?.userId && session?.sessionToken) {
    try {
      const db = await getDb();
      await db.collection("users").updateOne(
        { _id: new ObjectId(session.userId), activeSessionTokenHash: sha256(session.sessionToken) },
        { $unset: { activeSessionTokenHash: "", activeSessionAt: "" } }
      );
    } catch {}
  }

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
