import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { databases, projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { deployDatabaseContainer } from "@/lib/docker";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    await initializeDatabase();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    let query = db.select().from(databases).orderBy(desc(databases.createdAt));
    if (projectId) {
      // @ts-ignore
      query = db.select().from(databases).where(eq(databases.projectId, projectId)).orderBy(desc(databases.createdAt));
    }

    const allDbs = await query;
    return NextResponse.json(allDbs);
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
      type = "postgres",
      version = "latest",
      rootPassword,
      databaseName,
      databaseUser,
      databasePassword,
      exposedPort,
    } = body;

    if (!projectId || !name || !databaseName) {
      return NextResponse.json(
        { error: "projectId, name, and databaseName are required" },
        { status: 400 }
      );
    }

    const dbId = crypto.randomUUID();
    const cleanName = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const password = rootPassword || crypto.randomBytes(12).toString("hex");

    // Deploy container
    const deployed = await deployDatabaseContainer({
      dbType: type,
      version: version || "latest",
      name: cleanName,
      rootPassword: password,
      databaseName,
      databaseUser: databaseUser || (type === "postgres" ? "postgres" : "root"),
      databasePassword: databasePassword || password,
      exposedPort: exposedPort ? parseInt(exposedPort, 10) : undefined,
    });

    await db.insert(databases).values({
      id: dbId,
      projectId,
      name: cleanName,
      type,
      version: version || "latest",
      rootPassword: password,
      databaseName,
      databaseUser: databaseUser || (type === "postgres" ? "postgres" : "root"),
      databasePassword: databasePassword || password,
      exposedPort: exposedPort ? parseInt(exposedPort, 10) : null,
      internalPort: deployed.internalPort,
      containerId: deployed.container.id,
      status: "running",
      volumeName: deployed.volumeName,
    });

    const [created] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, dbId));

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
