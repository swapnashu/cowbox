import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, deployments, domains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker, buildTraefikLabels, deployAppContainer } from "@/lib/docker";
import crypto from "crypto";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  let newDeploymentId = crypto.randomUUID();
  let logBuffer: string[] = [];

  const addLog = (msg: string) => {
    const time = new Date().toISOString().substring(11, 19);
    logBuffer.push(`[${time}] ${msg}`);
  };

  try {
    const { deploymentId } = await req.json();
    if (!deploymentId) {
      return NextResponse.json({ error: "deploymentId is required" }, { status: 400 });
    }

    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const [oldDeployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId));

    if (!oldDeployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    if (oldDeployment.applicationId !== app.id) {
      return NextResponse.json({ error: "Deployment does not belong to this application" }, { status: 400 });
    }

    if (!oldDeployment.imageTag) {
      return NextResponse.json({ error: "Cannot rollback: No imageTag found for this deployment" }, { status: 400 });
    }

    const imageToRun = oldDeployment.imageTag;

    // Create new deployment record for rollback
    await db.insert(deployments).values({
      id: newDeploymentId,
      applicationId: app.id,
      title: `Rollback to deployment ${oldDeployment.title || oldDeployment.id}`,
      status: "building",
      imageTag: imageToRun,
      logs: `[${new Date().toISOString().substring(11, 19)}] Starting rollback for ${app.name}...`,
    });

    addLog(`Initiating rollback for ${app.name} to image ${imageToRun}`);

    const appDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.applicationId, params.id));

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

    // Stop and clean up old container if running
    if (app.containerId) {
      addLog(`Stopping current container ${app.containerId.substring(0, 12)}...`);
      try {
        const oldContainer = docker.getContainer(app.containerId);
        await oldContainer.stop().catch(() => {});
        await oldContainer.remove({ force: true }).catch(() => {});
        addLog(`Current container cleaned up`);
      } catch (err: any) {
        addLog(`Note: current container cleanup: ${err.message}`);
      }
    }

    // Deploy new container using previous imageTag
    addLog(`Creating and launching container from previous image ${imageToRun}...`);
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

    addLog(`Container started successfully! Container ID: ${container.id.substring(0, 12)}`);

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
        logs: logBuffer.join("\n"),
        durationSeconds: duration,
      })
      .where(eq(deployments.id, newDeploymentId));

    return NextResponse.json({
      success: true,
      deploymentId: newDeploymentId,
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
      .where(eq(deployments.id, newDeploymentId));

    return NextResponse.json(
      { error: error.message, logs: logBuffer },
      { status: 500 }
    );
  }
}
