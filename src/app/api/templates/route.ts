import { NextResponse } from "next/server";
import { APP_TEMPLATES } from "@/lib/templates";

export async function GET() {
  return NextResponse.json(APP_TEMPLATES);
}
