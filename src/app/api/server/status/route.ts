import { NextResponse } from "next/server";
import { checkDockerConnection, docker } from "@/lib/docker";
import { initializeDatabase } from "@/lib/db";
import os from "os";
import * as fs from "fs";

export async function GET() {
  try {
    await initializeDatabase();
    const dockerStatus = await checkDockerConnection();

    // Host system metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || "Multi-core Processor";
    const cpuSpeed = cpus[0]?.speed || 0;
    const loadAvg = os.loadavg();
    const uptime = os.uptime();

    // Detect server local/public IP for sslip.io
    let serverIp = "127.0.0.1";
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
          if (net.family === "IPv4" && !net.internal) {
            serverIp = net.address;
            break;
          }
        }
      }
    } catch (e) {}

    // Detailed Docker Engine system info
    let dockerInfo: any = null;
    let traefikRunning = false;
    let totalContainers = 0;
    let runningContainers = 0;
    let pausedContainers = 0;
    let stoppedContainers = 0;

    if (dockerStatus.connected) {
      try {
        const info = await docker.info();
        dockerInfo = {
          driver: info.Driver,
          rootDir: info.DockerRootDir,
          cgroupDriver: info.CgroupDriver,
          kernelVersion: info.KernelVersion,
          operatingSystem: info.OperatingSystem,
          architecture: info.Architecture,
          ncpu: info.NCPU,
          memTotal: info.MemTotal,
          serverVersion: info.ServerVersion,
        };

        totalContainers = info.Containers || 0;
        runningContainers = info.ContainersRunning || 0;
        pausedContainers = info.ContainersPaused || 0;
        stoppedContainers = info.ContainersStopped || 0;

        const containers = await docker.listContainers({ all: true });
        const traefik = containers.find((c) =>
          c.Names.some((n) => n.includes("traefik"))
        );
        traefikRunning = traefik ? traefik.State === "running" : false;
      } catch (e) {}
    }

    return NextResponse.json({
      connected: dockerStatus.connected,
      version: dockerStatus.version,
      containers: totalContainers,
      runningContainers,
      pausedContainers,
      stoppedContainers,
      images: dockerStatus.images || 0,
      serverIp,
      traefikRunning,
      dockerInfo,
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        cpuModel,
        cpuSpeed,
        cpuCount,
        loadAvg,
        uptime,
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          percent: Math.round((usedMem / totalMem) * 100),
        },
      },
      error: dockerStatus.error,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        connected: false,
        error: error.message || "Failed to fetch server status",
      },
      { status: 500 }
    );
  }
}
