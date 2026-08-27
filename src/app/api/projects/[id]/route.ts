import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { projects, applications, databases, composeStacks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, params.id));

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectApps = await db
      .select()
      .from(applications)
      .where(eq(applications.projectId, params.id));

    const projectDbs = await db
      .select()
      .from(databases)
      .where(eq(databases.projectId, params.id));

    const projectStacks = await db
      .select()
      .from(composeStacks)
      .where(eq(composeStacks.projectId, params.id));

    return NextResponse.json({
      ...project,
      applications: projectApps,
      databases: projectDbs,
      composeStacks: projectStacks,
    });
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

    // Find and cleanup any running containers associated with this project
    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.projectId, params.id));

    for (const app of apps) {
      if (app.containerId) {
        try {
          const container = docker.getContainer(app.containerId);
          await container.stop().catch(() => {});
          await container.remove({ force: true }).catch(() => {});
        } catch (e) {}
      }
    }

    const dbs = await db
      .select()
      .from(databases)
      .where(eq(databases.projectId, params.id));

    for (const database of dbs) {
      if (database.containerId) {
        try {
          const container = docker.getContainer(database.containerId);
          await container.stop().catch(() => {});
          await container.remove({ force: true }).catch(() => {});
        } catch (e) {}
      }
    }

    await db.delete(projects).where(eq(projects.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
