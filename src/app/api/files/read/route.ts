import { NextResponse } from "next/server";
import { resolveSafePath, WORKSPACE_ROOT } from "@/lib/workspace";
import * as fs from "fs";
import * as path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    const fullPath = resolveSafePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: "Path is a directory, not a file" }, { status: 400 });
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const extension = path.extname(fullPath).toLowerCase().replace(/^\./, "");

    return NextResponse.json({
      name: path.basename(fullPath),
      path: path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, "/"),
      content,
      extension,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
