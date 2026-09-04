import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getClientIp(request: NextRequest): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  return request.ip || '127.0.0.1';
}

export function middleware(request: NextRequest) {
  const cookie = request.cookies.get("cowbox-session");
  const path = request.nextUrl.pathname;

  if (path === '/api/auth/login') {
    const ip = getClientIp(request);
    const now = Date.now();

    // Clean up expired entries if map grows
    if (rateLimitMap.size > 1000) {
      rateLimitMap.forEach((val, key) => {
        if (val.resetTime <= now) rateLimitMap.delete(key);
      });
    }

    const limitData = rateLimitMap.get(ip);
    if (limitData && limitData.resetTime > now) {
      if (limitData.count >= 10) {
        return NextResponse.json(
          { error: "Too many login attempts. Please wait 60 seconds." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
      limitData.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60 * 1000 });
    }
  }

  const publicPaths = [
    '/login',
    '/api/auth/setup',
    '/api/auth/login',
    '/api/v1/deploy',
    '/api/webhooks',
    '/status',
    '/api/status/public',
    '/_next',
    '/favicon.ico',
  ];

  const isPublicPath = publicPaths.some(p => path.startsWith(p) || path === p);
  const authHeader = request.headers.get("authorization") || request.headers.get("x-api-key");

  if (!isPublicPath && !cookie && !authHeader) {
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
