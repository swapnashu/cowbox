import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Only trust proxy-supplied headers when explicitly behind a trusted reverse proxy.
const TRUST_PROXY = (process.env.TRUST_PROXY ?? "0") === "1";

function getClientIp(request: NextRequest): string {
  if (TRUST_PROXY) {
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) return cfConnectingIp.trim();

    const xRealIp = request.headers.get('x-real-ip');
    if (xRealIp) return xRealIp.trim();

    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      const firstIp = xForwardedFor.split(',')[0].trim();
      if (firstIp) return firstIp;
    }
  }

  return request.ip || '127.0.0.1';
}

function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 5000) {
    for (const [key, val] of Array.from(rateLimitMap.entries())) {
      if (val.resetTime <= now) rateLimitMap.delete(key);
    }
  }
  const data = rateLimitMap.get(ip);
  if (data && data.resetTime > now) {
    if (data.count >= limit) return false;
    data.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
  }
  return true;
}

export function middleware(request: NextRequest) {
  const cookie = request.cookies.get("cowbox-session");
  const path = request.nextUrl.pathname;
  const ip = getClientIp(request);

  if (path === '/api/auth/login') {
    if (!checkRateLimit(ip, 10, 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait 60 seconds." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) {
    if (!checkRateLimit(ip, 120, 60 * 1000)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  const publicPaths = [
    '/login',
    '/api/auth/setup',
    '/api/auth/login',
    '/status',
    '/api/status/public',
    '/_next',
    '/favicon.ico',
  ];

  const isPublicPath = publicPaths.some(p => path.startsWith(p) || path === p);

  if (!isPublicPath && !cookie) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
