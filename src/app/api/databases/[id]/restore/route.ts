import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { databases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";
import * as fs from "fs";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

const backupsDir = path.join(process.cwd(), "data", "backups");

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, params.id));

    if (!database || !database.containerId) {
      return NextResponse.json({ error: "Database container not found or not running" }, { status: 404 });
    }

    const { filename, rawSql } = await req.json();

    let backupFilePath = "";
    if (filename) {
      backupFilePath = path.join(backupsDir, path.basename(filename));
      if (!fs.existsSync(backupFilePath)) {
        return NextResponse.json({ error: "Backup file not found" }, { status: 404 });
      }
    } else if (!rawSql) {
      return NextResponse.json({ error: "Please provide a backup filename or raw SQL script" }, { status: 400 });
    }

    const container = docker.getContainer(database.containerId);
    const pass = database.databasePassword || database.rootPassword;
    const envList: string[] = [];
    let restoreCmd: string[] = [];

    if (database.type === "postgres") {
      if (pass) envList.push(`PGPASSWORD=${pass}`);
      restoreCmd = ["psql", "-U", database.databaseUser || "postgres", "-d", database.databaseName];
    } else if (database.type === "mysql" || database.type === "mariadb") {
      if (pass) envList.push(`MYSQL_PWD=${pass}`);
      restoreCmd = ["mysql", "-u", database.databaseUser || "root", database.databaseName];
    } else {
      return NextResponse.json({ error: `Restore not supported for ${database.type} via SQL` }, { status: 400 });
    }

    const exec = await container.exec({
      Cmd: restoreCmd,
      Env: envList.length > 0 ? envList : undefined,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: true });
    let output = "";

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf-8");
      });
      stream.on("end", () => resolve());
      stream.on("error", (err: any) => reject(err));

      if (backupFilePath) {
        const fileStream = fs.createReadStream(backupFilePath);
        fileStream.on("error", (err) => reject(err));
        fileStream.pipe(stream);
      } else {
        try {
          stream.write(rawSql);
          stream.end();
        } catch (err) {
          reject(err);
        }
      }
    });

    const inspect = await exec.inspect();
    const cleanOutput = output.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();

    return NextResponse.json({
      success: inspect.ExitCode === 0,
      message: inspect.ExitCode === 0 ? "Database snapshot restored successfully!" : "Restore completed with warnings",
      output: cleanOutput || "OK",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
