import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { databases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, params.id));

    if (!database) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    let connectionUrl = "";
    const user = database.databaseUser || "postgres";
    const pass = database.rootPassword;
    const dbName = database.databaseName;
    const host = `cowbox-db-${database.name}`;

    switch (database.type) {
      case "postgres":
        connectionUrl = `postgresql://${user}:${pass}@${host}:${database.internalPort}/${dbName}`;
        break;
      case "mysql":
      case "mariadb":
        connectionUrl = `mysql://${user}:${pass}@${host}:${database.internalPort}/${dbName}`;
        break;
      case "mongodb":
        connectionUrl = `mongodb://${user}:${pass}@${host}:${database.internalPort}/${dbName}`;
        break;
      case "redis":
        connectionUrl = `redis://:${pass}@${host}:${database.internalPort}`;
        break;
      case "clickhouse":
        connectionUrl = `clickhouse://${user}:${pass}@${host}:${database.internalPort}/${dbName}`;
        break;
    }

    return NextResponse.json({
      ...database,
      internalConnectionUrl: connectionUrl,
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
    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, params.id));

    if (database && database.containerId) {
      try {
        const container = docker.getContainer(database.containerId);
        await container.stop().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      } catch (e) {}
    }

    await db.delete(databases).where(eq(databases.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
