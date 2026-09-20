import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { statusMonitors, statusIncidents, applications, databases } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { docker } from "@/lib/docker";
import { requireAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();

    const monitors = await db.select().from(statusMonitors);
    const recentIncidents = await db
      .select()
      .from(statusIncidents)
      .orderBy(desc(statusIncidents.startedAt))
      .limit(10);

    const appCount = await db.select().from(applications);
    const dbCount = await db.select().from(databases);

    let containerStats = { total: 0, running: 0 };
    try {
      const containers = await docker.listContainers({ all: true });
      containerStats = {
        total: containers.length,
        running: containers.filter((c) => c.State === "running").length,
      };
    } catch (_) {}

    const allMonitorsUp = monitors.length > 0 ? monitors.every((m) => m.status === "up") : true;

    return NextResponse.json({
      status: allMonitorsUp ? "operational" : "degraded",
      timestamp: new Date().toISOString(),
      monitors: {
        total: monitors.length,
        up: monitors.filter((m) => m.status === "up").length,
        down: monitors.filter((m) => m.status === "down").length,
        items: monitors,
      },
      incidents: recentIncidents,
      summary: {
        applications: appCount.length,
        databases: dbCount.length,
        containers: containerStats,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
