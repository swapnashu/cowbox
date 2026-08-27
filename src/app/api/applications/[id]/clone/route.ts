import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, domains, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateSslipDomain } from "@/lib/domain";
import crypto from "crypto";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [sourceApp] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!sourceApp) {
      return NextResponse.json({ error: "Source application not found" }, { status: 404 });
    }

    const newAppId = crypto.randomUUID();
    const clonedName = `${sourceApp.name}-staging-${Math.floor(Math.random() * 1000)}`;

    await db.insert(applications).values({
      id: newAppId,
      projectId: sourceApp.projectId,
      name: clonedName,
      description: `Cloned staging environment from ${sourceApp.name}`,
      appType: sourceApp.appType,
      gitRepository: sourceApp.gitRepository,
      gitBranch: sourceApp.gitBranch,
      buildPath: sourceApp.buildPath,
      dockerfile: sourceApp.dockerfile,
      dockerImage: sourceApp.dockerImage,
      containerPort: sourceApp.containerPort,
      envVars: sourceApp.envVars,
      memoryLimit: sourceApp.memoryLimit,
      cpuLimit: sourceApp.cpuLimit,
      restartPolicy: sourceApp.restartPolicy,
      status: "stopped",
    });

    // Create staging sslip.io domain
    const stagingDomain = generateSslipDomain(clonedName, "127.0.0.1");
    await db.insert(domains).values({
      id: crypto.randomUUID(),
      applicationId: newAppId,
      domain: stagingDomain,
      https: true,
    });

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      action: "APP_CLONED",
      entityType: "application",
      entityId: newAppId,
      details: `Cloned '${sourceApp.name}' to staging app '${clonedName}'`,
      status: "success",
    });

    const [cloned] = await db.select().from(applications).where(eq(applications.id, newAppId));

    return NextResponse.json({
      success: true,
      message: `Cloned application to staging environment "${clonedName}"`,
      application: cloned,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
