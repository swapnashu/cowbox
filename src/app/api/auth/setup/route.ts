import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sessions } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { createSessionCookie, generateSessionToken } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const allUsers = await db.select().from(users).limit(1);
    const needsSetup = allUsers.length === 0;
    return NextResponse.json({ needsSetup });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const allUsers = await db.select().from(users).limit(1);
    if (allUsers.length > 0) {
      return NextResponse.json({ error: "Forbidden. Setup already complete." }, { status: 403 });
    }

    const { email, password, name } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      email,
      name,
      passwordHash: hashedPassword,
      role: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const token = generateSessionToken();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(sessions).values({
      id: sessionId,
      userId,
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    const cookieHeader = createSessionCookie(token);

    return new NextResponse(
      JSON.stringify({ user: { id: userId, email, name, role: "admin" } }),
      {
        status: 201,
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
