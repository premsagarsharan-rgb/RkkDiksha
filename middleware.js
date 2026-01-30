// middleware.js
import { NextResponse } from "next/server";

// Yahan koi jose, JWT, crypto nahi – sirf cookie presence check
export async function middleware(req) {
  const { pathname } = req.nextUrl;

  const sessionCookie = req.cookies.get("session")?.value || null;

  const isLogin = pathname.startsWith("/login");
  const isDashboard = pathname.startsWith("/dashboard");

  // Agar already logged in hai → /login pe aaega to redirect /dashboard
  if (isLogin && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Agar logged in nahi hai → /dashboard pe jaega to /login pe bhejo
  if (isDashboard && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*"],
};
