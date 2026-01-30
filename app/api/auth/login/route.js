import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { createSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req) {
  const body = await req.json();
  const { username, password } = body || {};

  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ username, active: true });
  if (!user) return NextResponse.json({ error: "Invalid login" }, { status: 401 });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid login" }, { status: 401 });

 await createSessionCookie({
  userId: String(user._id),
  role: user.role,
  username: user.username,
  permissions: user.permissions || null,
});
  return NextResponse.json({ ok: true });
}
