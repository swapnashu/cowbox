import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { projects, applications, databases } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  try {
    await initializeDatabase();
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));

    // Fetch counts of apps and dbs for each project
    const results = await Promise.all(
      allProjects.map(async (project) => {
        const apps = await db
          .select()
          .from(applications)
          .where(eq(applications.projectId, project.id));
        const dbs = await db
          .select()
          .from(databases)
          .where(eq(databases.projectId, project.id));

        return {
          ...project,
          applicationsCount: apps.length,
          databasesCount: dbs.length,
          runningAppsCount: apps.filter((a) => a.status === "running").length,
          runningDbsCount: dbs.filter((d) => d.status === "running").length,
        };
      })
    );

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
