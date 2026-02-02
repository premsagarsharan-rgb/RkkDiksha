import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import { createSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

function sha256(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest("hex");
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { username, password } = body || {};

  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ username, active: true });
  if (!user) return NextResponse.json({ error: "Invalid login" }, { status: 401 });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid login" }, { status: 401 });

  const sessionToken =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");

  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { activeSessionTokenHash: sha256(sessionToken), activeSessionAt: new Date() } }
  );

  await createSessionCookie({
    userId: String(user._id),
    role: user.role,
    username: user.username,
    permissions: user.permissions || null,
    sessionToken,
  });

  return NextResponse.json({ ok: true });
}
