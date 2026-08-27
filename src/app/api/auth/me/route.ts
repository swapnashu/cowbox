import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionToken } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const token = getSessionToken(req);

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [session] = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);

    if (!session || new Date(session.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    }).from(users).where(eq(users.id, session.userId)).limit(1);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
