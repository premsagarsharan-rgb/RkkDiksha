// lib/session.js
import { cookies } from "next/headers";

async function getCookieStore() {
  // Next 15/16 me cookies() kabhi Promise hota hai
  const c = cookies();
  return typeof c?.then === "function" ? await c : c;
}

export async function createSessionCookie(payload) {
  const value = JSON.stringify(payload);
  const store = await getCookieStore();

  store.set("session", value, {
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

export async function getSession() {
  const store = await getCookieStore();

  const raw = store.get("session")?.value;
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (!data.userId || !data.username || !data.role) return null;
    return data;
  } catch {
    return null;
  }
}
