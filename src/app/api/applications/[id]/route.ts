import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, domains, deployments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { docker } from "@/lib/docker";
import crypto from "crypto";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    const appDeployments = await db
      .select()
      .from(deployments)
      .where(eq(deployments.applicationId, params.id))
      .orderBy(desc(deployments.createdAt))
      .limit(10);

    return NextResponse.json({
      ...app,
      domains: appDomains,
      deployments: appDeployments,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const body = await req.json();
    const {
      name,
      description,
      appType,
      dockerImage,
      gitRepository,
      gitBranch,
      buildPath,
      dockerfile,
      containerPort,
      exposedPort,
      envVars,
      memoryLimit,
      cpuLimit,
      restartPolicy,
      domain,
    } = body;

    const updateData: Partial<typeof applications.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (appType !== undefined) updateData.appType = appType;
    if (dockerImage !== undefined) updateData.dockerImage = dockerImage;
    if (gitRepository !== undefined) updateData.gitRepository = gitRepository;
    if (gitBranch !== undefined) updateData.gitBranch = gitBranch;
    if (buildPath !== undefined) updateData.buildPath = buildPath;
    if (dockerfile !== undefined) updateData.dockerfile = dockerfile;
    if (containerPort !== undefined) updateData.containerPort = parseInt(containerPort, 10);
    if (exposedPort !== undefined) updateData.exposedPort = exposedPort ? parseInt(exposedPort, 10) : null;
    if (envVars !== undefined) updateData.envVars = envVars;
    if (memoryLimit !== undefined) updateData.memoryLimit = memoryLimit;
    if (cpuLimit !== undefined) updateData.cpuLimit = cpuLimit;
    if (restartPolicy !== undefined) updateData.restartPolicy = restartPolicy;

    await db
      .update(applications)
      .set(updateData)
      .where(eq(applications.id, params.id));

    // Update or add domain if specified
    if (domain !== undefined && domain.trim() !== "") {
      const existing = await db
        .select()
        .from(domains)
        .where(eq(domains.applicationId, params.id));
      if (existing.length > 0) {
        await db
          .update(domains)
          .set({ domain: domain.trim() })
          .where(eq(domains.id, existing[0].id));
      } else {
        await db.insert(domains).values({
          id: crypto.randomUUID(),
          applicationId: params.id,
          domain: domain.trim(),
          https: true,
          certificateResolver: "letsencrypt",
        });
      }
    }

    const [updated] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (app && app.containerId) {
      try {
        const container = docker.getContainer(app.containerId);
        await container.stop().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch (e) {}
    }

    await db.delete(applications).where(eq(applications.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
