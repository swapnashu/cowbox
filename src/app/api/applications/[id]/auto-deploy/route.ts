import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, deployments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

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

    const [latestDeployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.applicationId, app.id))
      .orderBy(desc(deployments.createdAt))
      .limit(1);

    const hostUrl = req.headers.get("host") || "localhost:9999";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const webhookUrl = `${protocol}://${hostUrl}/api/webhooks/deploy/${app.id}`;

    return NextResponse.json({
      applicationId: app.id,
      appName: app.name,
      autoDeploy: Boolean(app.autoDeploy),
      gitRepository: app.gitRepository,
      gitBranch: app.gitBranch || "main",
      webhookUrl,
      lastCommitHash: latestDeployment?.commitHash || null,
      lastCommitMessage: latestDeployment?.commitMessage || null,
      lastDeployedAt: latestDeployment?.createdAt || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const { autoDeploy, gitBranch, gitRepository } = await req.json();

    const updateData: Partial<typeof applications.$inferInsert> = {};
    if (autoDeploy !== undefined) updateData.autoDeploy = Boolean(autoDeploy);
    if (gitBranch !== undefined) updateData.gitBranch = gitBranch.trim();
    if (gitRepository !== undefined) updateData.gitRepository = gitRepository.trim();

    await db
      .update(applications)
      .set(updateData)
      .where(eq(applications.id, params.id));

    const [updated] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    return NextResponse.json({
      success: true,
      message: `Auto-deploy updated for "${updated.name}" (Enabled: ${Boolean(updated.autoDeploy)})`,
      application: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
