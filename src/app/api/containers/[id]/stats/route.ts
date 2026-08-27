import { NextResponse } from "next/server";
import { docker } from "@/lib/docker";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const container = docker.getContainer(params.id);
    const stats: any = await new Promise((resolve, reject) => {
      container.stats({ stream: false }, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // Calculate CPU usage percentage
    let cpuPercent = 0.0;
    try {
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
      const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage || 0);
      const onlineCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;

      if (systemDelta > 0.0 && cpuDelta > 0.0) {
        cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100.0;
      }
    } catch (e) {}

    // Calculate Memory usage
    const memoryUsed = stats.memory_stats?.usage || 0;
    const memoryLimit = stats.memory_stats?.limit || 1;
    const memoryPercent = Math.min(100, Math.round((memoryUsed / memoryLimit) * 100));

    // Calculate Network I/O
    let rxBytes = 0;
    let txBytes = 0;
    if (stats.networks) {
      for (const net of Object.values(stats.networks) as any[]) {
        rxBytes += net.rx_bytes || 0;
        txBytes += net.tx_bytes || 0;
      }
    }

    return NextResponse.json({
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      memory: {
        usedBytes: memoryUsed,
        limitBytes: memoryLimit,
        percent: memoryPercent,
      },
      network: {
        rxBytes,
        txBytes,
      },
      pids: stats.pids_stats?.current || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
