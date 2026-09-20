import { NextRequest } from "next/server";
import crypto from "crypto";

export function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function createSessionCookie(token: string) {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  return `cowbox-session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `cowbox-session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function getSessionToken(request: NextRequest) {
  return request.cookies.get("cowbox-session")?.value || null;
}
