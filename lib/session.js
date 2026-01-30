// lib/session.js
import { cookies } from "next/headers";

export async function createSessionCookie(payload) {
  const value = JSON.stringify(payload);

  cookies().set("session", value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearSessionCookie() {
  cookies().set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession() {
  const raw = cookies().get("session")?.value;
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (!data.userId || !data.username || !data.role) return null;
    return data;
  } catch {
    return null;
  }
}
