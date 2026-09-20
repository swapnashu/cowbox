import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

const buildsBaseDir = path.join(process.cwd(), "data", "builds");

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const body = await req.json();
    const { filePath, content, encoding } = body;

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json({ error: "filePath is required (relative to build root)" }, { status: 400 });
    }

    const appBuildDir = app.buildPath || path.join(buildsBaseDir, app.id);
    
    if (!fs.existsSync(appBuildDir)) {
      fs.mkdirSync(appBuildDir, { recursive: true });
      if (!app.buildPath) {
        await db.update(applications)
          .set({ buildPath: appBuildDir })
          .where(eq(applications.id, app.id));
      }
    }

    const resolvedBuildDir = path.resolve(appBuildDir);
    const targetPath = path.resolve(resolvedBuildDir, filePath.replace(/^[\/\\]+/, ""));
    
    if (!targetPath.startsWith(resolvedBuildDir + path.sep) && targetPath !== resolvedBuildDir) {
      return NextResponse.json({ error: "Security Violation: Illegal path traversal detected." }, { status: 403 });
    }

    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const fileEncoding = encoding === "base64" ? "base64" : "utf-8";
    fs.writeFileSync(targetPath, content ?? "", fileEncoding as BufferEncoding);

    const stats = fs.statSync(targetPath);

    return NextResponse.json({
      success: true,
      message: `File ${path.basename(targetPath)} saved successfully.`,
      path: filePath,
      sizeBytes: stats.size,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const subPath = searchParams.get("path") || "";
    const list = searchParams.get("list") === "true";

    const appBuildDir = app.buildPath || path.join(buildsBaseDir, app.id);
    if (!fs.existsSync(appBuildDir)) {
      return NextResponse.json({ error: "Build directory does not exist yet" }, { status: 404 });
    }

    const resolvedBuildDir = path.resolve(appBuildDir);
    const targetPath = path.resolve(resolvedBuildDir, subPath.replace(/^[\/\\]+/, ""));

    if (!targetPath.startsWith(resolvedBuildDir + path.sep) && targetPath !== resolvedBuildDir) {
      return NextResponse.json({ error: "Security Violation: Illegal path traversal detected." }, { status: 403 });
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "Path does not exist" }, { status: 404 });
    }

    const stats = fs.statSync(targetPath);

    if (stats.isDirectory() && list) {
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      const items = entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size: entry.isFile() ? fs.statSync(path.join(targetPath, entry.name)).size : 0,
      }));
      return NextResponse.json({ items });
    } else if (stats.isFile()) {
      const content = fs.readFileSync(targetPath, "utf-8");
      return NextResponse.json({ content });
    } else {
      return NextResponse.json({ error: "Requested path is a directory. Use ?list=true to list contents." }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const targetFilePath = searchParams.get("path");

    if (!targetFilePath) {
      return NextResponse.json({ error: "path parameter is required" }, { status: 400 });
    }

    const appBuildDir = app.buildPath || path.join(buildsBaseDir, app.id);
    const resolvedBuildDir = path.resolve(appBuildDir);
    const targetPath = path.resolve(resolvedBuildDir, targetFilePath.replace(/^[\/\\]+/, ""));

    if (!targetPath.startsWith(resolvedBuildDir + path.sep) && targetPath !== resolvedBuildDir) {
      return NextResponse.json({ error: "Security Violation: Illegal path traversal detected." }, { status: 403 });
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "File does not exist" }, { status: 404 });
    }

    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }

    return NextResponse.json({ success: true, message: `Deleted ${path.basename(targetPath)}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
