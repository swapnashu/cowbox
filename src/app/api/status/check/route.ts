import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { statusMonitors, statusIncidents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";
import crypto from "crypto";
import net from "net";

async function checkHttp(url: string, expectedStatus: number): Promise<{ isUp: boolean, time: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const time = Date.now() - start;
    return { isUp: res.status === expectedStatus, time };
  } catch {
    return { isUp: false, time: Date.now() - start };
  }
}

async function checkTcp(url: string): Promise<{ isUp: boolean, time: number }> {
  // url format expected: hostname:port
  const [host, portStr] = url.replace('tcp://', '').split(':');
  const port = parseInt(portStr, 10);
  const start = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      const time = Date.now() - start;
      socket.destroy();
      resolve({ isUp: true, time });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ isUp: false, time: Date.now() - start });
    });
    
    socket.on('error', () => {
      resolve({ isUp: false, time: Date.now() - start });
    });
    
    socket.connect(port, host);
  });
}

export async function POST(req: Request) {
  try {
    await initializeDatabase();
    const monitors = await db.select().from(statusMonitors).where(eq(statusMonitors.enabled, true));
    
    for (const monitor of monitors) {
      let isUp = false;
      let responseTimeMs = 0;
      
      try {
        if (monitor.type === "http" && monitor.url) {
          const res = await checkHttp(monitor.url, monitor.expectedStatusCode || 200);
          isUp = res.isUp;
          responseTimeMs = res.time;
        } else if (monitor.type === "tcp" && monitor.url) {
          const res = await checkTcp(monitor.url);
          isUp = res.isUp;
          responseTimeMs = res.time;
        } else if (monitor.type === "container" && monitor.containerId) {
          const start = Date.now();
          const containerInfo = await docker.getContainer(monitor.containerId).inspect();
          isUp = containerInfo.State.Running;
          responseTimeMs = Date.now() - start;
        }
      } catch (e) {
        isUp = false;
      }
      
      const newStatus = isUp ? "up" : "down";
      
      // If status changed to down, create an incident
      if (newStatus === "down" && monitor.status === "up") {
         await db.insert(statusIncidents).values({
           id: crypto.randomUUID(),
           monitorId: monitor.id,
           status: "investigating",
           message: `Monitor ${monitor.name} went down.`,
         });
      }
      
      // If status changed to up, resolve active incidents
      if (newStatus === "up" && monitor.status === "down") {
         const activeIncidents = await db.select().from(statusIncidents).where(eq(statusIncidents.monitorId, monitor.id));
         for (const incident of activeIncidents) {
           if (incident.status !== "resolved") {
             await db.update(statusIncidents)
               .set({ status: "resolved", resolvedAt: new Date().toISOString() })
               .where(eq(statusIncidents.id, incident.id));
           }
         }
      }
      
      await db
        .update(statusMonitors)
        .set({
          status: newStatus,
          lastCheck: new Date().toISOString(),
          responseTimeMs,
        })
        .where(eq(statusMonitors.id, monitor.id));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
