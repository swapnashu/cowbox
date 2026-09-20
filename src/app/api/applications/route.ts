import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, domains, projects } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    let allApps;
    if (projectId) {
      allApps = await db.select().from(applications).where(eq(applications.projectId, projectId)).orderBy(desc(applications.createdAt));
    } else {
      allApps = await db.select().from(applications).orderBy(desc(applications.createdAt));
    }

    const appIds = allApps.map(a => a.id);
    const allDomains = appIds.length > 0
      ? await db.select().from(domains).where(inArray(domains.applicationId, appIds))
      : [];

    const domainsByApp = new Map<string, typeof allDomains>();
    for (const d of allDomains) {
      const list = domainsByApp.get(d.applicationId) || [];
      list.push(d);
      domainsByApp.set(d.applicationId, list);
    }

    const results = allApps.map((app) => ({
      ...app,
      domains: domainsByApp.get(app.id) || [],
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[Applications] GET error:", error.message);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
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
    console.error("[Applications] POST error:", error.message);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
