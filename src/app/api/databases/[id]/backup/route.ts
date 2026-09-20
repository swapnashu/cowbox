import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { databases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";
import * as fs from "fs";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

const backupsDir = path.join(process.cwd(), "data", "backups");
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

export async function GET(
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

    if (!database) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const files = fs.readdirSync(backupsDir);
    const dbBackups = files
      .filter((f) => f.startsWith(`${database.name}-`))
      .map((fileName) => {
        const stats = fs.statSync(path.join(backupsDir, fileName));
        return {
          fileName,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(dbBackups);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    if (!database) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${database.name}-${timestamp}.sql`;
    const filePath = path.join(backupsDir, fileName);

    // If container is active, execute dump or create backup record
    if (database.containerId) {
      try {
        const container = docker.getContainer(database.containerId);
        const pass = database.databasePassword || database.rootPassword;
        const envList: string[] = [];
        let cmd: string[] = [];

        if (database.type === "postgres") {
          if (pass) envList.push(`PGPASSWORD=${pass}`);
          cmd = ["pg_dump", "-U", database.databaseUser || "postgres", database.databaseName];
        } else if (database.type === "mysql" || database.type === "mariadb") {
          if (pass) envList.push(`MYSQL_PWD=${pass}`);
          cmd = ["mysqldump", "-u", database.databaseUser || "root", database.databaseName];
        } else if (database.type === "redis") {
          if (pass) envList.push(`REDISCLI_AUTH=${pass}`);
          cmd = ["sh", "-c", "redis-cli --rdb -"];
        } else if (database.type === "mongodb") {
          const user = database.databaseUser || "root";
          if (pass) {
            cmd = ["mongodump", "-u", user, "-p", pass, "--authenticationDatabase", "admin", "--archive"];
          } else {
            cmd = ["mongodump", "--archive"];
          }
        } else if (database.type === "clickhouse") {
          cmd = ["clickhouse-client", "-q", `BACKUP DATABASE ${database.databaseName} TO Disk('backups', '${fileName}')`];
        } else {
          throw new Error(`Unsupported database type: ${database.type}`);
        }

        const exec = await container.exec({
          Cmd: cmd,
          Env: envList.length > 0 ? envList : undefined,
          AttachStdout: true,
          AttachStderr: true,
        });

        const stream = await exec.start({ hijack: true });
        const outputStream = fs.createWriteStream(filePath);
        let errorOutput = "";
        const errStream = new (require("stream").PassThrough)();
        errStream.on("data", (chunk: Buffer) => {
          errorOutput += chunk.toString("utf-8");
        });

        await new Promise((resolve, reject) => {
          docker.modem.demuxStream(stream, outputStream, errStream);
          stream.on("end", resolve);
          stream.on("error", reject);
        });

        const inspectData = await exec.inspect();
        if (inspectData.ExitCode !== 0 && inspectData.ExitCode !== null) {
          try { fs.unlinkSync(filePath); } catch (_) {}
          throw new Error(`Dump process exited with code ${inspectData.ExitCode}: ${errorOutput.trim() || "Unknown error"}`);
        }
      } catch (dumpErr: any) {
        try { fs.unlinkSync(filePath); } catch (_) {}
        return NextResponse.json({ error: `Database backup failed: ${dumpErr.message}` }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Database container is not running" }, { status: 400 });
    }

    const stats = fs.statSync(filePath);

    return NextResponse.json({
      success: true,
      backup: {
        fileName,
        sizeBytes: stats.size,
        createdAt: new Date().toISOString(),
      },
      message: "Database backup created successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
