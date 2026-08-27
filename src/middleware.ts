import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

export function middleware(request: NextRequest) {
  const cookie = request.cookies.get("cowbox-session");
  const path = request.nextUrl.pathname;

  if (path === '/api/auth/login') {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const limitData = rateLimitMap.get(ip);
    if (limitData && limitData.resetTime > now) {
      if (limitData.count >= 5) {
        return new NextResponse("Too Many Requests", { status: 429 });
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

  if (!isPublicPath && !cookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
