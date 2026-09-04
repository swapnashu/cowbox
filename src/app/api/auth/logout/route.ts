import { NextRequest, NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clearSessionCookie, getSessionToken } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    await initializeDatabase();
    const token = getSessionToken(req);

    if (token) {
      await db.delete(sessions).where(eq(sessions.token, token));
    }

    const cookieHeader = clearSessionCookie();

    return new NextResponse(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieHeader,
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
