import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";

async function getCookieStore() {
  const c = cookies();
  return typeof c?.then === "function" ? await c : c;
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest("hex");
}

export async function createSessionCookie(payload) {
  const store = await getCookieStore();
  store.set("session", JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await getCookieStore();
  store.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// ✅ single active login enforced via users.activeSessionTokenHash
export async function getSession() {
  const store = await getCookieStore();
  const raw = store.get("session")?.value;
  if (!raw) return null;

  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const { userId, sessionToken } = data || {};
  if (!userId || !sessionToken) return null;

  try {
    const db = await getDb();
    const u = await db.collection("users").findOne(
      { _id: new ObjectId(userId), active: true },
      { projection: { username: 1, role: 1, permissions: 1, activeSessionTokenHash: 1 } }
    );
    if (!u) return null;

    const hash = sha256(sessionToken);
    if (!u.activeSessionTokenHash || u.activeSessionTokenHash !== hash) return null;

    return {
      userId: String(u._id),
      username: u.username,
      role: u.role,
      permissions: u.permissions || null,
      sessionToken,
    };
  } catch {
    return null;
  }
}
