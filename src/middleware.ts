import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Simple in-memory rate limiter
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return timestamps.length <= RATE_LIMIT;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth pages and static files
  if (
    pathname === "/" ||
    pathname === "/demo" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Rate limit API routes
  if (pathname.startsWith("/api")) {
    const ip =
      request.headers.get("x-forwarded-for") ?? request.ip ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
    }
  }

  // Check authentication
  const token = await getToken({ req: request });
  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
