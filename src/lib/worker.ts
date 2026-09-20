import cron, { ScheduledTask } from "node-cron";
import { db } from "@/lib/db";
import { cronJobs, statusMonitors, statusIncidents, metrics } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { docker } from "@/lib/docker";
import crypto from "crypto";
import { exec } from "child_process";
import net from "net";
import { checkForUpdates } from "@/lib/updater";
import { dispatchEvent } from "@/lib/notifications/dispatcher";

export let workerStarted = false;
let lastNotifiedUpdateVersion = "";
const activeScheduledTasks = new Map<string, ScheduledTask>();
const intervalHandles: NodeJS.Timeout[] = [];

const runningTasks = new Set<string>();

async function checkHttp(url: string, expectedStatus: number): Promise<{ isUp: boolean; time: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    clearTimeout(timeoutId);
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

function isPrivateIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|::1|fc|fd)/.test(ip);
}

export async function runStatusChecks() {
  if (runningTasks.has("statusChecks")) return;
  runningTasks.add("statusChecks");
  try {
    const monitors = await db.select().from(statusMonitors).where(eq(statusMonitors.enabled, true));
    for (const monitor of monitors) {
      let isUp = false;
      let responseTimeMs = 0;
      try {
        if (monitor.type === "http" && monitor.url) {
          const urlObj = new URL(monitor.url);
          if (isPrivateIP(urlObj.hostname)) continue;
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
    console.error("[Worker] Status check error:", err);
  } finally {
    runningTasks.delete("statusChecks");
  }
}

export async function syncCronJobs() {
  if (runningTasks.has("cronSync")) return;
  runningTasks.add("cronSync");
  try {
    const jobs = await db.select().from(cronJobs).where(eq(cronJobs.enabled, true));
    const currentJobIds = new Set(jobs.map((j) => j.id));

    for (const [jobId, task] of Array.from(activeScheduledTasks.entries())) {
      if (!currentJobIds.has(jobId)) {
        task.stop();
        activeScheduledTasks.delete(jobId);
      }
    }

    for (const job of jobs) {
      if (activeScheduledTasks.has(job.id)) continue;
      if (!cron.validate(job.schedule)) continue;

      const task = cron.schedule(job.schedule, async () => {
        let output = "";
        let success = true;

        if (job.targetType === "http") {
          try {
            const urlObj = new URL(job.command);
            if (isPrivateIP(urlObj.hostname)) {
              output = "Error: HTTP target resolves to private IP";
              success = false;
            } else {
              const res = await fetch(job.command, { method: "GET" });
              output = `HTTP ${res.status} ${res.statusText}`;
              success = res.ok;
            }
          } catch (err: any) {
            output = `HTTP Error: ${err.message}`;
            success = false;
          }
        } else {
          output = await new Promise<string>((resolve) => {
            exec(job.command, { timeout: 60000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
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
    console.error("[Worker] Cron sync error:", err);
  } finally {
    runningTasks.delete("cronSync");
  }
}

import util from "util";
import { applications, deployments } from "@/lib/db/schema";
import { and, isNotNull, desc } from "drizzle-orm";

const execAsync = util.promisify(exec);

export async function pollGitAutoDeploy() {
  if (runningTasks.has("gitPoll")) return;
  runningTasks.add("gitPoll");
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

          const [latestDeployment] = await db
            .select()
            .from(deployments)
            .where(eq(deployments.applicationId, app.id))
            .orderBy(desc(deployments.createdAt))
            .limit(1);

          if (!latestDeployment || latestDeployment.commitHash !== remoteCommit) {
            console.log(`[Auto-Deploy] New commit ${remoteCommit.substring(0, 7)} on ${app.name} (${branch}). Triggering build...`);
            const port = process.env.PORT || 9999;
            fetch(`http://127.0.0.1:${port}/api/applications/${app.id}/deploy`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }).catch(() => {});
          }
        }
      } catch (gitErr) {
        // Ignore git network errors
      }
    }
  } catch (err) {
    console.error("[Worker] Git poll error:", err);
  } finally {
    runningTasks.delete("gitPoll");
  }
}

export async function collectContainerMetrics() {
  if (runningTasks.has("metrics")) return;
  runningTasks.add("metrics");
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
          for (const net of Object.values(stats.networks) as any[]) {
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
      } catch (statError) {
        // Container may have stopped between list and stats
      }
    }

    await db.delete(metrics).where(sql`timestamp <= datetime('now', '-24 hours')`).catch(() => {});
  } catch (err) {
    console.error("[Worker] Metrics collection error:", err);
  } finally {
    runningTasks.delete("metrics");
  }
}

export async function checkAutoUpdates() {
  if (runningTasks.has("updates")) return;
  runningTasks.add("updates");
  try {
    const updateInfo = await checkForUpdates(false);
    if (updateInfo.hasUpdate && updateInfo.latestVersion !== lastNotifiedUpdateVersion) {
      lastNotifiedUpdateVersion = updateInfo.latestVersion;
      console.log(
        `[Cowbox Auto-Updater] New version v${updateInfo.latestVersion} is available (running v${updateInfo.currentVersion})`
      );

      await dispatchEvent("system:update_available", {
        title: `Cowbox Update Available: v${updateInfo.latestVersion}`,
        message: `Cowbox v${updateInfo.latestVersion} is now available (current: v${updateInfo.currentVersion}). Upgrade via: ${updateInfo.instructions[updateInfo.activeMethod]}`,
        status: "warning",
      });
    }
  } catch (err) {
    // Network errors during update check are expected
  } finally {
    runningTasks.delete("updates");
  }
}

export function stopBackgroundWorker() {
  for (const handle of intervalHandles) {
    clearInterval(handle);
  }
  intervalHandles.length = 0;

  for (const [jobId, task] of Array.from(activeScheduledTasks.entries())) {
    task.stop();
  }
  activeScheduledTasks.clear();
  workerStarted = false;
  console.log("[Cowbox Daemon] Background worker stopped");
}

export function startBackgroundWorker() {
  if (workerStarted) return;
  if (typeof window !== "undefined") return;

  workerStarted = true;
  console.log("[Cowbox Daemon] Starting Background Worker...");

  runStatusChecks();
  syncCronJobs();
  pollGitAutoDeploy();
  collectContainerMetrics();
  checkAutoUpdates();

  intervalHandles.push(setInterval(() => { runStatusChecks(); }, 60000));
  intervalHandles.push(setInterval(() => { syncCronJobs(); }, 30000));
  intervalHandles.push(setInterval(() => { pollGitAutoDeploy(); }, 60000));
  intervalHandles.push(setInterval(() => { collectContainerMetrics(); }, 30000));
  intervalHandles.push(setInterval(() => { checkAutoUpdates(); }, 2 * 60 * 60 * 1000));

  process.on("SIGTERM", stopBackgroundWorker);
  process.on("SIGINT", stopBackgroundWorker);
}
