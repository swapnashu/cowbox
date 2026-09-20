import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
