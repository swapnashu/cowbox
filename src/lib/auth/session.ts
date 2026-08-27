import { NextRequest } from "next/server";
import crypto from "crypto";

export function generateSessionToken() {
  return crypto.randomUUID();
}

export function createSessionCookie(token: string) {
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  return `cowbox-session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `cowbox-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function getSessionToken(request: NextRequest) {
  return request.cookies.get("cowbox-session")?.value || null;
}
