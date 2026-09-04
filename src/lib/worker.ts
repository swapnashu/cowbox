import cron, { ScheduledTask } from "node-cron";
import { db } from "@/lib/db";
import { cronJobs, statusMonitors, statusIncidents, metrics } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { docker } from "@/lib/docker";
import crypto from "crypto";
import { exec } from "child_process";
import net from "net";

export let workerStarted = false;
const activeScheduledTasks = new Map<string, ScheduledTask>();

async function checkHttp(url: string, expectedStatus: number): Promise<{ isUp: boolean; time: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const time = Date.now() - start;
    return { isUp: res.status === expectedStatus, time };
  } catch {
    return { isUp: false, time: Date.now() - start };
  }
}

async function checkTcp(url: string): Promise<{ isUp: boolean; time: number }> {
  const [host, portStr] = url.replace("tcp://", "").split(":");
  const port = parseInt(portStr, 10);
  const start = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.on("connect", () => {
      const time = Date.now() - start;
      socket.destroy();
      resolve({ isUp: true, time });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ isUp: false, time: Date.now() - start });
    });
    socket.on("error", () => {
      resolve({ isUp: false, time: Date.now() - start });
    });
    socket.connect(port, host);
  });
}

export async function runStatusChecks() {
  try {
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
      if (newStatus === "down" && monitor.status === "up") {
        await db.insert(statusIncidents).values({
          id: crypto.randomUUID(),
          monitorId: monitor.id,
          status: "investigating",
          message: `Monitor ${monitor.name} went down.`,
        });
      }

      if (newStatus === "up" && monitor.status === "down") {
        const activeIncidents = await db.select().from(statusIncidents).where(eq(statusIncidents.monitorId, monitor.id));
        for (const incident of activeIncidents) {
          if (incident.status !== "resolved") {
            await db
              .update(statusIncidents)
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
  } catch (err) {
    // Ignore worker tick error
  }
}

export async function syncCronJobs() {
  try {
    const jobs = await db.select().from(cronJobs).where(eq(cronJobs.enabled, true));
    const currentJobIds = new Set(jobs.map((j) => j.id));

    // Stop tasks no longer in DB or disabled
    for (const [jobId, task] of Array.from(activeScheduledTasks.entries())) {
      if (!currentJobIds.has(jobId)) {
        task.stop();
        activeScheduledTasks.delete(jobId);
      }
    }

    // Schedule newly enabled or updated jobs
    for (const job of jobs) {
      if (activeScheduledTasks.has(job.id)) continue;
      if (!cron.validate(job.schedule)) continue;

      const task = cron.schedule(job.schedule, async () => {
        let output = "";
        let success = true;

        if (job.targetType === "http") {
          try {
            const res = await fetch(job.command, { method: "GET" });
            output = `HTTP ${res.status} ${res.statusText}`;
            success = res.ok;
          } catch (err: any) {
            output = `HTTP Error: ${err.message}`;
            success = false;
          }
        } else {
          output = await new Promise<string>((resolve) => {
            exec(job.command, { timeout: 60000 }, (error, stdout, stderr) => {
              if (error) {
                success = false;
                resolve(`Error (code ${error.code}): ${stderr || error.message}`);
              } else {
                resolve(stdout || "Executed with code 0 (no output)");
              }
            });
          });
        }

        const runTimestamp = new Date().toISOString();
        await db
          .update(cronJobs)
          .set({
            lastRun: runTimestamp,
            lastStatus: success ? "success" : "failed",
            logs: `[${runTimestamp}] ${output}`,
          })
          .where(eq(cronJobs.id, job.id));
      });

      activeScheduledTasks.set(job.id, task);
    }
  } catch (err) {
    // Ignore sync error
  }
}

import util from "util";
import { applications, deployments } from "@/lib/db/schema";
import { and, isNotNull, desc } from "drizzle-orm";

const execAsync = util.promisify(exec);

export async function pollGitAutoDeploy() {
  try {
    const autoApps = await db
      .select()
      .from(applications)
      .where(and(eq(applications.autoDeploy, true), isNotNull(applications.gitRepository)));

    for (const app of autoApps) {
      if (!app.gitRepository) continue;
      const branch = app.gitBranch || "main";

      try {
        const { stdout } = await execAsync(`git ls-remote "${app.gitRepository}" refs/heads/${branch}`);
        const match = stdout.trim().match(/^([0-9a-f]{40})\s+/i);
        if (match) {
          const remoteCommit = match[1];

          // Get last deployment commit
          const [latestDeployment] = await db
            .select()
            .from(deployments)
            .where(eq(deployments.applicationId, app.id))
            .orderBy(desc(deployments.createdAt))
            .limit(1);

          if (!latestDeployment || latestDeployment.commitHash !== remoteCommit) {
            console.log(`🚀 [Auto-Deploy Daemon] Detected new commit ${remoteCommit.substring(0, 7)} on ${app.name} (${branch}). Triggering build...`);
            fetch(`http://127.0.0.1:9999/api/applications/${app.id}/deploy`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }).catch(() => {});
          }
        }
      } catch (gitErr) {
        // Ignore git network / auth poll errors during interval
      }
    }
  } catch (err) {}
}

export async function collectContainerMetrics() {
  try {
    const containers = await docker.listContainers({ filters: { status: ["running"] } });
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      try {
        const stats: any = await container.stats({ stream: false });
        let cpuPercent = 0;
        const cpuDelta = stats.cpu_stats?.cpu_usage?.total_usage - stats.precpu_stats?.cpu_usage?.total_usage;
        const systemCpuDelta = stats.cpu_stats?.system_cpu_usage - stats.precpu_stats?.system_cpu_usage;
        const numberCpus = stats.cpu_stats?.online_cpus || stats.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;

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
          memoryTotalBytes = stats.memory_stats.limit || 0;
        }

        let networkRxBytes = 0;
        let networkTxBytes = 0;
        if (stats.networks) {
          for (const net of Object.values<any>(stats.networks)) {
            networkRxBytes += net.rx_bytes || 0;
            networkTxBytes += net.tx_bytes || 0;
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
      } catch (statError) {}
    }

    await db.delete(metrics).where(sql`datetime(timestamp, 'localtime') <= datetime('now', '-24 hours', 'localtime')`).catch(() => {});
  } catch (err) {}
}

export function startBackgroundWorker() {
  if (workerStarted) return;
  if (typeof window !== "undefined") return; // Only run on server

  workerStarted = true;
  console.log("🚀 [Cowbox Daemon] Starting Background Worker (Cron, Metrics, Git Auto-Deploy & Status Monitors)...");

  // Run initial tasks
  runStatusChecks();
  syncCronJobs();
  pollGitAutoDeploy();
  collectContainerMetrics();

  // Run status checks every 60 seconds
  setInterval(() => {
    runStatusChecks();
  }, 60000);

  // Sync cron jobs periodically every 30 seconds
  setInterval(() => {
    syncCronJobs();
  }, 30000);

  // Poll Git repositories for auto-deployments every 60 seconds
  setInterval(() => {
    pollGitAutoDeploy();
  }, 60000);

  // Collect performance metrics for running containers every 30 seconds
  setInterval(() => {
    collectContainerMetrics();
  }, 30000);
}
