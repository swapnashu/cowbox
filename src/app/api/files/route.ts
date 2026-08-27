import { NextResponse } from "next/server";
import { ensureWorkspaceDir, resolveSafePath, WORKSPACE_ROOT } from "@/lib/workspace";
import * as fs from "fs";
import * as path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subPath = searchParams.get("path") || "";
    const targetDir = resolveSafePath(subPath);

    if (!fs.existsSync(targetDir)) {
      return NextResponse.json({ error: "Directory does not exist" }, { status: 404 });
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });

    const items = entries.map((entry) => {
      const fullPath = path.join(targetDir, entry.name);
      const relativePath = path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, "/");
      const stats = fs.statSync(fullPath);

      let extension = "";
      if (entry.isFile()) {
        extension = path.extname(entry.name).toLowerCase().replace(/^\./, "");
      }

      return {
        name: entry.name,
        path: relativePath,
        isDirectory: entry.isDirectory(),
        sizeBytes: stats.size,
        extension,
        updatedAt: stats.mtime.toISOString(),
      };
    });

    // Sort: directories first, then alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      currentPath: subPath.replace(/\\/g, "/"),
      items,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { filePath, content } = await req.json();
    if (!filePath || filePath.trim() === "") {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    const fullPath = resolveSafePath(filePath);
    const parentDir = path.dirname(fullPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content ?? "", "utf-8");

    const stats = fs.statSync(fullPath);

    return NextResponse.json({
      success: true,
      message: `File ${path.basename(fullPath)} saved successfully`,
      path: path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, "/"),
      sizeBytes: stats.size,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    const fullPath = resolveSafePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File does not exist" }, { status: 404 });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    return NextResponse.json({ success: true, message: `Deleted ${path.basename(fullPath)}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
