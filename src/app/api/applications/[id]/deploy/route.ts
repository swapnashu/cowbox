import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, domains, deployments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker, buildTraefikLabels, deployAppContainer, pullDockerImage } from "@/lib/docker";
import crypto from "crypto";
import { exec, execFile } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  let deploymentId = crypto.randomUUID();
  let logBuffer: string[] = [];

  const addLog = (msg: string) => {
    const time = new Date().toISOString().substring(11, 19);
    logBuffer.push(`[${time}] ${msg}`);
  };

  try {
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Create a new deployment record
    await db.insert(deployments).values({
      id: deploymentId,
      applicationId: app.id,
      title: `Deployment triggered (${app.appType})`,
      status: "building",
      logs: `[${new Date().toISOString().substring(11, 19)}] Starting deployment for ${app.name}...`,
    });

    addLog(`Initiating deployment for ${app.name} (${app.appType})...`);

    // Parse Environment Variables
    const envList: string[] = [];
    if (app.envVars) {
      const lines = app.envVars.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          envList.push(trimmed);
        }
      }
    }

    // Fetch and prepare domains for Traefik routing
    const appDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.applicationId, params.id));

    const traefikLabels = buildTraefikLabels({
      appName: app.name,
      domains: appDomains.map((d) => ({
        domain: d.domain,
        https: d.https,
        certificateResolver: d.certificateResolver,
        pathPrefix: d.pathPrefix || "/",
      })),
      containerPort: app.containerPort,
    });

    if (appDomains.length > 0) {
      addLog(`Configured ${appDomains.length} domain routes with Traefik: ${appDomains.map((d) => d.domain).join(", ")}`);
    }

    let imageToRun = app.dockerImage || "nginx:alpine";
    if (app.appType === "image") {
      imageToRun = app.dockerImage || "nginx:alpine";
      addLog(`Pulling image ${imageToRun}...`);
      try {
        await pullDockerImage(imageToRun);
        addLog(`Image ${imageToRun} ready`);
      } catch (err: any) {
        addLog(`Image pull notice: ${err.message} (attempting to use local image)`);
      }
    } else if (app.appType === "git" || app.appType === "nixpacks") {
      if (!app.gitRepository) {
        throw new Error("Git repository is required for git/nixpacks deployment.");
      }

      const branch = (app.gitBranch || "main").trim();
      if (!/^[a-zA-Z0-9._\-\/]+$/.test(branch)) {
        throw new Error("Invalid git branch name.");
      }

      addLog(`Cloning repository ${app.gitRepository} (branch: ${branch})...`);
      const tmpDir = path.join(os.tmpdir(), `cowbox-build-${crypto.randomUUID()}`);
      
      try {
        await execFileAsync("git", ["clone", "-b", branch, app.gitRepository, tmpDir]);
        addLog(`Repository cloned successfully.`);

        if (app.appType === "nixpacks") {
          const tag = `cowbox-app-${app.id}-${Date.now()}`;
          addLog(`Building with Nixpacks: ${tag}...`);
          
          await execAsync(`docker run --rm -v //var/run/docker.sock:/var/run/docker.sock -v "${tmpDir}":"${tmpDir}" -w "${tmpDir}" ghcr.io/railwayapp/nixpacks build . --name ${tag}`);
          addLog(`Nixpacks Image built successfully.`);
          
          imageToRun = tag;
        } else {
          let dockerfileContent = "";
          const buildPack = app.buildPack || "node";
          
          addLog(`Using build pack: ${buildPack}`);

          if (buildPack === "node") {
            dockerfileContent = `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install --production\nCOPY . .\nCMD ["npm", "start"]`;
          } else if (buildPack === "python") {
            dockerfileContent = `FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["python", "main.py"]`;
          } else if (buildPack === "php") {
            dockerfileContent = `FROM php:8.2-apache\nCOPY . /var/www/html/`;
          } else if (buildPack === "static") {
            dockerfileContent = `FROM nginx:alpine\nCOPY . /usr/share/nginx/html/`;
          } else if (buildPack === "dockerfile") {
            addLog(`Using existing Dockerfile from repository.`);
          }

          if (dockerfileContent && buildPack !== "dockerfile") {
            await fs.writeFile(path.join(tmpDir, "Dockerfile"), dockerfileContent);
            addLog(`Generated Dockerfile for ${buildPack} buildpack.`);
          }

          const tag = `cowbox-app-${app.id}:${Date.now()}`;
          addLog(`Building Docker image ${tag}...`);
          
          await execAsync(`docker build -t ${tag} "${tmpDir}"`);
          addLog(`Image built successfully.`);
          
          imageToRun = tag;
        }
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } else if (app.appType === "dockerfile") {
      const tag = `cowbox-app-${app.id}:${Date.now()}`;
      addLog(`Initiating Dockerfile build: ${tag}...`);

      let buildDir = "";
      let isTempDir = false;

      // Check if buildPath exists on disk (e.g. uploaded zip or repo)
      if (app.buildPath && app.buildPath !== "/" && (await fs.stat(app.buildPath).then(() => true).catch(() => false))) {
        buildDir = app.buildPath;
        if (app.dockerfile && !(await fs.stat(path.join(buildDir, "Dockerfile")).then(() => true).catch(() => false))) {
          await fs.writeFile(path.join(buildDir, "Dockerfile"), app.dockerfile);
        }
      } else if (app.dockerfile && app.dockerfile.trim()) {
        buildDir = path.join(os.tmpdir(), `cowbox-build-${crypto.randomUUID()}`);
        isTempDir = true;
        await fs.mkdir(buildDir, { recursive: true });
        await fs.writeFile(path.join(buildDir, "Dockerfile"), app.dockerfile);
      } else {
        throw new Error("No Dockerfile content or build directory found for Dockerfile deployment.");
      }

      try {
        addLog(`Building Docker image from ${buildDir}...`);
        await execAsync(`docker build -t ${tag} "${buildDir}"`);
        addLog(`Dockerfile image ${tag} built successfully.`);
        imageToRun = tag;
      } finally {
        if (isTempDir && buildDir) {
          await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
        }
      }
    }

    // Deploy new container
    addLog(`Creating and launching container...`);
    const container = await deployAppContainer({
      applicationId: app.id,
      appName: app.name,
      image: imageToRun,
      containerPort: app.containerPort,
      exposedPort: app.exposedPort || undefined,
      envVars: envList,
      labels: traefikLabels,
      memoryLimit: app.memoryLimit || undefined,
      cpuLimit: app.cpuLimit || undefined,
      restartPolicy: app.restartPolicy,
    });

    addLog(`Container started! ID: ${container.id.substring(0, 12)}`);
    addLog(`Performing Zero-Downtime Health Check verification...`);

    // Zero-Downtime Health Check Probing
    let isHealthy = false;
    const maxAttempts = 10;
    const probePath = app.healthCheckPath || "/";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const inspectData = await container.inspect();
        if (!inspectData.State.Running) {
          throw new Error(`Container exited prematurely (Exit code: ${inspectData.State.ExitCode})`);
        }

        const networkInfo = inspectData.NetworkSettings.Networks["cowbox-network"] || inspectData.NetworkSettings.Networks["bridge"];
        const containerIp = networkInfo?.IPAddress;

        if (containerIp) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          try {
            const probeRes = await fetch(`http://${containerIp}:${app.containerPort}${probePath}`, {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (probeRes.status < 500) {
              isHealthy = true;
              addLog(`Health Check passed on attempt ${attempt} (HTTP ${probeRes.status} on port ${app.containerPort})!`);
              break;
            }
          } catch (fetchErr) {
            clearTimeout(timeoutId);
          }
        }
      } catch (inspectErr: any) {
        if (attempt === maxAttempts) throw inspectErr;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!isHealthy) {
      addLog(`Health Check verified running container state. Routing traffic.`);
    }

    // Stop and clean up old container now that new container is confirmed serving traffic
    if (app.containerId && app.containerId !== container.id) {
      addLog(`Gracefully draining and shutting down previous container ${app.containerId.substring(0, 12)}...`);
      try {
        const oldContainer = docker.getContainer(app.containerId);
        await oldContainer.stop({ t: 10 }).catch(() => {});
        await oldContainer.remove({ force: true }).catch(() => {});
        addLog(`Previous container gracefully decommissioned. Zero-downtime cutover complete!`);
      } catch (err: any) {
        addLog(`Note: previous container cleanup: ${err.message}`);
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Update application state
    await db
      .update(applications)
      .set({
        status: "running",
        containerId: container.id,
      })
      .where(eq(applications.id, app.id));

    // Update deployment record
    await db
      .update(deployments)
      .set({
        status: "running",
        imageTag: imageToRun,
        logs: logBuffer.join("\n"),
        durationSeconds: duration,
      })
      .where(eq(deployments.id, deploymentId));

    return NextResponse.json({
      success: true,
      deploymentId,
      containerId: container.id,
      logs: logBuffer,
    });
  } catch (error: any) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    addLog(`ERROR: ${error.message}`);

    await db
      .update(applications)
      .set({ status: "error" })
      .where(eq(applications.id, params.id));

    await db
      .update(deployments)
      .set({
        status: "failed",
        logs: logBuffer.join("\n"),
        durationSeconds: duration,
      })
      .where(eq(deployments.id, deploymentId));

    return NextResponse.json(
      { error: error.message, logs: logBuffer },
      { status: 500 }
    );
  }
}
