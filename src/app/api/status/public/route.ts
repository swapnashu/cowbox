import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { statusMonitors, statusIncidents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await initializeDatabase();
    const monitors = await db.select().from(statusMonitors).where(eq(statusMonitors.enabled, true));
    
    const publicMonitors = [];
    
    for (const m of monitors) {
      const incidents = await db.select().from(statusIncidents).where(eq(statusIncidents.monitorId, m.id));
      
      publicMonitors.push({
        id: m.id,
        name: m.name,
        status: m.status,
        lastCheck: m.lastCheck,
        responseTimeMs: m.responseTimeMs,
        activeIncidents: incidents.filter(i => i.status !== "resolved").length
      });
    }

    return NextResponse.json(publicMonitors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
