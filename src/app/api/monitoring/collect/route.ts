import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { metrics } from "@/lib/db/schema";
import { docker } from "@/lib/docker";
import crypto from "crypto";
import { sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    await initializeDatabase();
    
    // Fetch all running containers
    const containers = await docker.listContainers({ filters: { status: ["running"] } });
    
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      
      try {
        const stats: any = await container.stats({ stream: false });
        
        let cpuPercent = 0;
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemCpuDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const numberCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;

        if (systemCpuDelta > 0 && cpuDelta > 0) {
          cpuPercent = (cpuDelta / systemCpuDelta) * numberCpus * 100.0;
        }

        let memoryUsedBytes = 0;
        let memoryTotalBytes = 0;

        if (stats.memory_stats && stats.memory_stats.usage) {
          memoryUsedBytes = stats.memory_stats.usage;
          if (stats.memory_stats.stats && stats.memory_stats.stats.cache) {
            memoryUsedBytes -= stats.memory_stats.stats.cache;
          }
          memoryTotalBytes = stats.memory_stats.limit;
        }
        
        let networkRxBytes = 0;
        let networkTxBytes = 0;
        if (stats.networks) {
          for (const net of Object.values<any>(stats.networks)) {
            networkRxBytes += net.rx_bytes;
            networkTxBytes += net.tx_bytes;
          }
        }

        await db.insert(metrics).values({
          id: crypto.randomUUID(),
          containerId: containerInfo.Id,
          cpuPercent: cpuPercent.toFixed(2),
          memoryUsedBytes,
          memoryTotalBytes,
          networkRxBytes,
          networkTxBytes,
        });

      } catch (statError) {
        console.error(`Error getting stats for container ${containerInfo.Id}`, statError);
      }
    }
    
    // Cleanup old metrics (older than 24 hours)
    await db.delete(metrics).where(sql`datetime(timestamp, 'localtime') <= datetime('now', '-24 hours', 'localtime')`);

    return NextResponse.json({ success: true, collected: containers.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
