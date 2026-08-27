import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { databases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";
import * as fs from "fs";
import * as path from "path";

const backupsDir = path.join(process.cwd(), "data", "backups");

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, params.id));

    if (!database || !database.containerId) {
      return NextResponse.json({ error: "Database container not found or not running" }, { status: 404 });
    }

    const { filename, rawSql } = await req.json();

    let sqlContent = "";
    if (filename) {
      const backupPath = path.join(backupsDir, path.basename(filename));
      if (!fs.existsSync(backupPath)) {
        return NextResponse.json({ error: "Backup file not found" }, { status: 404 });
      }
      sqlContent = fs.readFileSync(backupPath, "utf-8");
    } else if (rawSql) {
      sqlContent = rawSql;
    } else {
      return NextResponse.json({ error: "Please provide a backup filename or raw SQL script" }, { status: 400 });
    }

    const container = docker.getContainer(database.containerId);

    let restoreCmd: string[] = [];
    if (database.type === "postgres") {
      restoreCmd = ["psql", "-U", database.databaseUser || "postgres", "-d", database.databaseName, "-c", sqlContent];
    } else if (database.type === "mysql" || database.type === "mariadb") {
      restoreCmd = ["mysql", "-u", database.databaseUser || "root", `-p${database.rootPassword}`, database.databaseName, "-e", sqlContent];
    } else {
      return NextResponse.json({ error: `Restore not supported for ${database.type} via SQL` }, { status: 400 });
    }

    const exec = await container.exec({
      Cmd: restoreCmd,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    let output = "";
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf-8");
      });
      stream.on("end", () => resolve());
      stream.on("error", (err: any) => reject(err));
    });

    const inspect = await exec.inspect();

    return NextResponse.json({
      success: inspect.ExitCode === 0,
      message: inspect.ExitCode === 0 ? "Database snapshot restored successfully!" : "Restore completed with warnings",
      output: output.trim() || "OK",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
