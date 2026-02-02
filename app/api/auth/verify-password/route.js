import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { password } = body || {};
  if (!password) return NextResponse.json({ error: "Password required" }, { status: 400 });

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { username: session.username, active: true },
    { projection: { passwordHash: 1 } }
  );

  if (!user?.passwordHash) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Wrong password" }, { status: 401 });

  return NextResponse.json({ ok: true });
}
