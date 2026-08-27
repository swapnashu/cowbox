import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, domains, projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    await initializeDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    let query = db.select().from(applications).orderBy(desc(applications.createdAt));
    if (projectId) {
      // @ts-ignore
      query = db.select().from(applications).where(eq(applications.projectId, projectId)).orderBy(desc(applications.createdAt));
    }

    const allApps = await query;

    // Attach domains for each app
    const results = await Promise.all(
      allApps.map(async (app) => {
        const appDomains = await db
          .select()
          .from(domains)
          .where(eq(domains.applicationId, app.id));
        return {
          ...app,
          domains: appDomains,
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
    const body = await req.json();
    const {
      projectId,
      name,
      description,
      appType = "image",
      dockerImage,
      gitRepository,
      gitBranch = "main",
      buildPath = "/",
      buildPack,
      dockerfile = "",
      containerPort = 80,
      exposedPort,
      envVars = "",
      domain,
    } = body;

    if (!projectId || !name) {
      return NextResponse.json(
        { error: "projectId and name are required" },
        { status: 400 }
      );
    }

    const appId = crypto.randomUUID();
    const cleanName = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");

    await db.insert(applications).values({
      id: appId,
      projectId,
      name: cleanName,
      description: description || "",
      appType,
      dockerImage: dockerImage || null,
      gitRepository: gitRepository || null,
      gitBranch: gitBranch || "main",
      buildPath: buildPath || "/",
      buildPack: buildPack || null,
      dockerfile: dockerfile || null,
      containerPort: parseInt(containerPort, 10) || 80,
      exposedPort: exposedPort ? parseInt(exposedPort, 10) : null,
      envVars: envVars || "",
      status: "stopped",
    });

    if (domain) {
      await db.insert(domains).values({
        id: crypto.randomUUID(),
        applicationId: appId,
        domain: domain.trim(),
        https: true,
        certificateResolver: "letsencrypt",
        pathPrefix: "/",
        stripPrefix: false,
      });
    }

    const [createdApp] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, appId));

    return NextResponse.json(createdApp, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
