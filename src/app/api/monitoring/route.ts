import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { metrics } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await initializeDatabase();
    
    const { searchParams } = new URL(req.url);
    const containerId = searchParams.get("containerId");
    const hoursStr = searchParams.get("hours");
    const hours = hoursStr ? parseInt(hoursStr, 10) : 24;

    let condition = sql`datetime(timestamp, 'localtime') >= datetime('now', ${`-${hours} hours`}, 'localtime')`;
    
    if (containerId) {
      condition = and(condition, eq(metrics.containerId, containerId)) as any;
    }

    const data = await db
      .select()
      .from(metrics)
      .where(condition)
      .orderBy(metrics.timestamp);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
