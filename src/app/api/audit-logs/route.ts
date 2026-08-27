import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
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
