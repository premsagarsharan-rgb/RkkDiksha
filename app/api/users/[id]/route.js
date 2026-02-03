// app/api/users/[id]/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// ✅ updated permission keys (new + legacy)
const PERM_KEYS = [
  "recent",
  "add",
  "calander",
  "pending",
  "sitting",
  "tracker",
  "screensCreate",
  "screensView",
  "screens", // legacy
];

function normalizePermissionsForSave(nextInput, prevPerms) {
  // merge prev + next so partial patch doesn't delete other keys
  const raw = { ...(prevPerms || {}), ...(nextInput || {}) };

  // legacy mapping: screens -> both
  if (typeof raw.screens === "boolean") {
    if (typeof raw.screensCreate !== "boolean") raw.screensCreate = raw.screens;
    if (typeof raw.screensView !== "boolean") raw.screensView = raw.screens;
  }

  // keep legacy in sync
  if (typeof raw.screensCreate === "boolean" || typeof raw.screensView === "boolean") {
    raw.screens = !!(raw.screensCreate || raw.screensView);
  }

  // whitelist only allowed keys
  const clean = {};
  for (const k of PERM_KEYS) {
    if (typeof raw[k] === "boolean") clean[k] = raw[k];
  }
  return clean;
}

export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const db = await getDb();
  const _id = new ObjectId(id);

  const user = await db.collection("users").findOne({ _id }, { projection: { permissions: 1, role: 1 } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const $set = { updatedAt: new Date() };

  if (body.username) $set.username = String(body.username).trim();
  if (body.role && ["ADMIN", "USER"].includes(body.role)) $set.role = body.role;
  if (typeof body.active === "boolean") $set.active = body.active;

  if (body.password) {
    $set.passwordHash = await bcrypt.hash(String(body.password), 12);
  }

  // ✅ Permissions patch (works for check + uncheck)
  if (body.permissions && typeof body.permissions === "object") {
    const prev = user.permissions && typeof user.permissions === "object" ? user.permissions : {};
    const clean = normalizePermissionsForSave(body.permissions, prev);
    $set.permissions = clean;
  }

  await db.collection("users").updateOne({ _id }, { $set });

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
