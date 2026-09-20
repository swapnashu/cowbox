import { NextResponse } from "next/server";
import { APP_TEMPLATES } from "@/lib/templates";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) return auth.response!;
  return NextResponse.json(APP_TEMPLATES);
}
