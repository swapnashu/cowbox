import { NextResponse } from "next/server";
import { resolveAccessPath, WORKSPACE_ROOT, AccessDeniedError } from "@/lib/workspace";
import * as fs from "fs/promises";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, "files:read");
    if (!auth.authenticated) return auth.response!;
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");
    const isAdmin = auth.user?.role === "admin";
    const rootMode = (searchParams.get("root") === "1" || searchParams.get("root") === "true") && isAdmin;

    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    const fullPath = resolveAccessPath(filePath, { isAdmin, allowRoot: rootMode });

    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: "Path is a directory, not a file" }, { status: 400 });
    }

    if (stat.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const content = await fs.readFile(fullPath, "utf-8");
    const extension = path.extname(fullPath).toLowerCase().replace(/^\./, "");
    const relOrAbs = rootMode ? fullPath.replace(/\\/g, "/") : path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, "/");

    return NextResponse.json({
      name: path.basename(fullPath),
      path: relOrAbs,
      content,
      extension,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files/Read] GET error:", error.message);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
