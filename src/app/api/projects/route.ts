import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { projects, applications, databases } from "@/lib/db/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));

    const projectIds = allProjects.map(p => p.id);

    const allApps = projectIds.length > 0
      ? await db.select().from(applications).where(inArray(applications.projectId, projectIds))
      : [];
    const allDbs = projectIds.length > 0
      ? await db.select().from(databases).where(inArray(databases.projectId, projectIds))
      : [];

    const appsByProject = new Map<string, typeof allApps>();
    const dbsByProject = new Map<string, typeof allDbs>();

    for (const app of allApps) {
      const list = appsByProject.get(app.projectId) || [];
      list.push(app);
      appsByProject.set(app.projectId, list);
    }
    for (const db_ of allDbs) {
      const list = dbsByProject.get(db_.projectId) || [];
      list.push(db_);
      dbsByProject.set(db_.projectId, list);
    }

    const results = allProjects.map((project) => {
      const apps = appsByProject.get(project.id) || [];
      const dbs = dbsByProject.get(project.id) || [];
      return {
        ...project,
        applicationsCount: apps.length,
        databasesCount: dbs.length,
        runningAppsCount: apps.filter((a) => a.status === "running").length,
        runningDbsCount: dbs.filter((d) => d.status === "running").length,
      };
    });

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[Projects] GET error:", error.message);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const { name, description } = await req.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.insert(projects).values({
      id,
      name: name.trim(),
      description: description?.trim() || "",
    });

    const [created] = await db.select().from(projects).where(eq(projects.id, id));
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("[Projects] POST error:", error.message);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
