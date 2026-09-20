import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export function middleware(request: NextRequest) {
  const cookie = request.cookies.get("cowbox-session");
  const path = request.nextUrl.pathname;
  // Kept for future logging if needed, rate limiting removed per user request
  const ip = getClientIp(request);

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
