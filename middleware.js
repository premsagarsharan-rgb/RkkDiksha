// middleware.js
import { NextResponse } from "next/server";

// NOTE:
// Middleware DB check nahi kar sakta (Mongo native driver edge me nahi chalta).
// Isliye yahan sirf dashboard ko "cookie presence" se protect karo.
// /login ko redirect mat karo, kyunki cookie stale bhi ho sakti hai.

export function middleware(req) {
  const { pathname } = req.nextUrl;

  const sessionCookie = req.cookies.get("session")?.value || null;
  const isDashboard = pathname.startsWith("/dashboard");

  // ✅ Agar logged in nahi hai → /dashboard pe jaega to /login
  if (isDashboard && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
