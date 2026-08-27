import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { createSessionCookie, generateSessionToken } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = generateSessionToken();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    const cookieHeader = createSessionCookie(token);

    return new NextResponse(
      JSON.stringify({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }),
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
