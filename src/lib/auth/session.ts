import { NextRequest } from "next/server";
import crypto from "crypto";

export function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function createSessionCookie(token: string) {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  return `cowbox-session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  return `cowbox-session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function getSessionToken(request: NextRequest) {
  return request.cookies.get("cowbox-session")?.value || null;
}
