import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, projects, deployments, domains, auditLogs } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { verifyApiRequest } from "@/lib/auth/api-key";
import { generateSslipDomain } from "@/lib/domain";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    // 1. Verify API Key with Bulletproof Auth
    const auth = await verifyApiRequest(req, "deploy:write");
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    await initializeDatabase();
    const body = await req.json();
    const {
      applicationId,
      appName,
      projectName = "Default Project",
      appType = "image",
      dockerImage,
      gitRepository,
      gitBranch = "main",
      dockerfile,
      containerPort = 80,
      envVars = "",
    } = body;

    let targetApp: any = null;

    // A) If applicationId provided, locate application
    if (applicationId) {
      const [existing] = await db
        .select()
        .from(applications)
        .where(eq(applications.id, applicationId));
      if (!existing) {
        return NextResponse.json({ error: "Application with specified applicationId not found" }, { status: 404 });
      }
      targetApp = existing;
    } 
    // B) If appName provided, locate or create application
    else if (appName) {
      const [existing] = await db
        .select()
        .from(applications)
        .where(eq(applications.name, appName));

      if (existing) {
        targetApp = existing;
        // Optionally update image / envVars
        if (dockerImage || envVars) {
          await db
            .update(applications)
            .set({
              dockerImage: dockerImage || existing.dockerImage,
              envVars: envVars || existing.envVars,
              containerPort: containerPort || existing.containerPort,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(applications.id, existing.id));
          const [updated] = await db.select().from(applications).where(eq(applications.id, existing.id));
          targetApp = updated;
        }
      } else {
        // Resolve or create project
        let targetProj = (await db.select().from(projects))[0];
        if (!targetProj) {
          const newProjId = crypto.randomUUID();
          await db.insert(projects).values({ id: newProjId, name: projectName });
          [targetProj] = await db.select().from(projects).where(eq(projects.id, newProjId));
        }

        const newAppId = crypto.randomUUID();
        await db.insert(applications).values({
          id: newAppId,
          projectId: targetProj.id,
          name: appName.trim(),
          appType,
          dockerImage: dockerImage || "nginx:alpine",
          gitRepository,
          gitBranch,
          dockerfile,
          containerPort: parseInt(containerPort.toString()) || 80,
          envVars,
          status: "building",
        });

        // Create default domain
        const defaultDomain = generateSslipDomain(appName, "127.0.0.1");
        await db.insert(domains).values({
          id: crypto.randomUUID(),
          applicationId: newAppId,
          domain: defaultDomain,
          https: true,
        });

        [targetApp] = await db.select().from(applications).where(eq(applications.id, newAppId));
      }
    } else {
      return NextResponse.json(
        { error: "Must specify either 'applicationId' or 'appName' in request body" },
        { status: 400 }
      );
    }

    // 2. Trigger the deployment engine
    const deployStartTime = Date.now();
    const deploymentId = crypto.randomUUID();

    await db.insert(deployments).values({
      id: deploymentId,
      applicationId: targetApp.id,
      title: `API Deployment (${auth.keyRecord?.name || "API Key"})`,
      status: "building",
    });

    // Execute deploy
    const deployUrl = new URL(`/api/applications/${targetApp.id}/deploy`, req.url).toString();
    const deployRes = await fetch(deployUrl, { method: "POST" });
    const deployData = await deployRes.json();

    const durationSeconds = Math.round((Date.now() - deployStartTime) / 1000);

    // 3. Log Audit Record
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      action: "DEPLOY_API_INVOKED",
      entityType: "application",
      entityId: targetApp.id,
      details: `Deployed app '${targetApp.name}' via API key '${auth.keyRecord?.name}' in ${durationSeconds}s`,
      status: deployRes.ok ? "success" : "failed",
    });

    if (!deployRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: deployData.error || "Deployment failed",
          application: targetApp,
          durationSeconds,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Application '${targetApp.name}' deployed successfully via API!`,
      application: {
        id: targetApp.id,
        name: targetApp.name,
        status: "running",
        containerPort: targetApp.containerPort,
      },
      deployment: {
        id: deploymentId,
        durationSeconds,
        status: "running",
      },
      authenticatedAs: auth.keyRecord?.name,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
