// app/api/users/[id]/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const PERM_KEYS = ["recent", "add", "calander", "pending", "sitting"];

export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const $set = { updatedAt: new Date() };

  if (body.username) $set.username = String(body.username).trim();
  if (body.role && ["ADMIN", "USER"].includes(body.role)) $set.role = body.role;
  if (typeof body.active === "boolean") $set.active = body.active;

  if (body.password) {
    $set.passwordHash = await bcrypt.hash(body.password, 12);
  }

  // Permissions patch
  if (body.permissions && typeof body.permissions === "object") {
    const clean = {};
    for (const k of PERM_KEYS) {
      if (typeof body.permissions[k] === "boolean") clean[k] = body.permissions[k];
    }
    $set.permissions = clean;
  }

  const db = await getDb();
  await db.collection("users").updateOne({ _id: new ObjectId(id) }, { $set });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (session.userId === id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("users").deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ ok: true });
}
