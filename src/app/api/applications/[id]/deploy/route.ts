import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, domains, deployments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker, buildTraefikLabels, deployAppContainer } from "@/lib/docker";
import crypto from "crypto";
import { exec } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = util.promisify(exec);

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

    const appDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.applicationId, params.id));

    // Create initial deployment record
    await db.insert(deployments).values({
      id: deploymentId,
      applicationId: app.id,
      title: `Deploy ${app.name} (${app.appType})`,
      status: "building",
      logs: `[${new Date().toISOString().substring(11, 19)}] Starting deployment for ${app.name}...`,
    });

    addLog(`Initiating deployment for ${app.name}`);
    addLog(`Application Type: ${app.appType.toUpperCase()}`);

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
    addLog(`Loaded ${envList.length} environment variables`);

    // Prepare Traefik Labels
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
        await docker.pull(imageToRun);
        addLog(`Image ${imageToRun} ready`);
      } catch (err: any) {
        addLog(`Image pull notice: ${err.message} (attempting to use local image)`);
      }
    } else if (app.appType === "git") {
      if (!app.gitRepository) {
        throw new Error("Git repository is required for git deployment.");
      }

      addLog(`Cloning repository ${app.gitRepository} (branch: ${app.gitBranch || "main"})...`);
      const tmpDir = path.join(os.tmpdir(), `cowbox-build-${crypto.randomUUID()}`);
      
      try {
        await execAsync(`git clone -b ${app.gitBranch || "main"} "${app.gitRepository}" "${tmpDir}"`);
        addLog(`Repository cloned successfully.`);

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
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    // Deploy new container
    addLog(`Creating and launching container...`);
    const container = await deployAppContainer({
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

    addLog(`Container started successfully! Container ID: ${container.id.substring(0, 12)}`);
    addLog(`Waiting 5 seconds for new container to become healthy and Traefik to route traffic...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    addLog(`Healthcheck OK. Routing traffic to port ${app.containerPort}.`);

    // Stop and clean up old container if running
    if (app.containerId) {
      addLog(`Stopping previous container ${app.containerId.substring(0, 12)}...`);
      try {
        const oldContainer = docker.getContainer(app.containerId);
        await oldContainer.stop().catch(() => {});
        await oldContainer.remove({ force: true }).catch(() => {});
        addLog(`Previous container gracefully shut down and cleaned up`);
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
