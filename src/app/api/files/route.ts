import { NextResponse } from "next/server";
import { ensureWorkspaceDir, resolveSafePath, resolveAccessPath, isProtectedSystemPath, formatMode, modeString, WORKSPACE_ROOT, AccessDeniedError } from "@/lib/workspace";
import * as fs from "fs/promises";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

function useRoot(mode: string | null | boolean): boolean {
  return mode === true || mode === "1" || mode === "true";
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, "files:read");
    if (!auth.authenticated) return auth.response!;
    const { searchParams } = new URL(req.url);
    const subPath = searchParams.get("path") || "";
    const isAdmin = auth.user?.role === "admin";
    const rootMode = useRoot(searchParams.get("root")) && isAdmin;

    const targetDir = resolveAccessPath(subPath, { isAdmin, allowRoot: rootMode });

    try {
      await fs.access(targetDir);
    } catch {
      return NextResponse.json({ error: "Directory does not exist" }, { status: 404 });
    }

    // In root mode with empty path, list top-level entries (drive roots on Windows, "/" elsewhere)
    if (rootMode && !subPath.trim()) {
      if (process.platform === "win32") {
        const drives: string[] = [];
        for (let code = 65; code <= 90; code++) {
          const letter = String.fromCharCode(code);
          const drivePath = `${letter}:\\`;
          try { await fs.access(drivePath); drives.push(drivePath); } catch { /* skip */ }
        }
        const driveItems = drives.map((d) => ({
          name: d,
          path: d.replace(/\\/g, "/"),
          isDirectory: true,
          sizeBytes: 0,
          extension: "",
          updatedAt: new Date(0).toISOString(),
          mode: "drwxr-xr-x",
          modeCode: "755",
        }));
        return NextResponse.json({ currentPath: "", root: true, items: driveItems });
      }
    }

    const entries = await fs.readdir(targetDir, { withFileTypes: true });

    const items = (
      await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(targetDir, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          let extension = "";
          if (entry.isFile()) {
            extension = path.extname(entry.name).toLowerCase().replace(/^\./, "");
          }
          return {
            name: entry.name,
            path: rootMode
              ? fullPath.replace(/\\/g, "/")
              : path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, "/"),
            isDirectory: entry.isDirectory(),
            sizeBytes: stats.size,
            extension,
            updatedAt: stats.mtime.toISOString(),
            mode: (entry.isDirectory() ? "d" : "-") + formatMode(stats.mode),
            modeCode: modeString(stats.mode),
          };
        } catch {
          // Access-denied or unreadable entries (e.g. protected system files) are skipped.
          return null;
        }
      }))
    ).filter((x): x is NonNullable<typeof x> => x !== null);

    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      currentPath: subPath.replace(/\\/g, "/"),
      root: rootMode,
      targetDir: rootMode ? targetDir.replace(/\\/g, "/") : undefined,
      items,
    });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files] GET error:", error.message);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, "files:write");
    if (!auth.authenticated) return auth.response!;
    const { filePath, content, root } = await req.json();
    if (!filePath || filePath.trim() === "") {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    const isAdmin = auth.user?.role === "admin";
    const fullPath = resolveAccessPath(filePath, { isAdmin, allowRoot: useRoot(root) });
    const parentDir = path.dirname(fullPath);

    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(fullPath, content ?? "", "utf-8");
    const stats = await fs.stat(fullPath);

    return NextResponse.json({
      success: true,
      message: `File ${path.basename(fullPath)} saved successfully`,
      path: useRoot(root) && isAdmin ? fullPath.replace(/\\/g, "/") : path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, "/"),
      sizeBytes: stats.size,
    });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files] POST error:", error.message);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req, "files:write");
    if (!auth.authenticated) return auth.response!;
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");
    const rootMode = useRoot(searchParams.get("root")) && auth.user?.role === "admin";

    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    const fullPath = resolveAccessPath(filePath, { isAdmin: auth.user?.role === "admin", allowRoot: rootMode });

    if (isProtectedSystemPath(fullPath)) {
      return NextResponse.json({ error: "Refusing to delete a protected system path (drive root or app root)" }, { status: 400 });
    }

    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json({ error: "File does not exist" }, { status: 404 });
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }

    return NextResponse.json({ success: true, message: `Deleted ${path.basename(fullPath)}` });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files] DELETE error:", error.message);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAuth(req, "files:write");
    if (!auth.authenticated) return auth.response!;
    const body = await req.json();
    const { action, oldPath, newPath, sourcePath, destPath, root, mode, path: chmodPath } = body;
    const isAdmin = auth.user?.role === "admin";
    const rootMode = useRoot(root);

    if (action === "copy") {
      if (!sourcePath || !destPath) {
        return NextResponse.json({ error: "sourcePath and destPath are required for copy" }, { status: 400 });
      }
      const fullSource = resolveAccessPath(sourcePath, { isAdmin, allowRoot: rootMode });
      const fullDest = resolveAccessPath(destPath, { isAdmin, allowRoot: rootMode });
      try {
        await fs.access(fullSource);
      } catch {
        return NextResponse.json({ error: "Source file does not exist" }, { status: 404 });
      }
      await fs.mkdir(path.dirname(fullDest), { recursive: true });
      const srcStat = await fs.stat(fullSource);
      if (srcStat.isDirectory()) {
        await fs.cp(fullSource, fullDest, { recursive: true });
      } else {
        await fs.copyFile(fullSource, fullDest);
      }
      return NextResponse.json({ success: true, message: `Copied to ${path.basename(fullDest)}` });
    }

    if (action === "chmod") {
      if (!chmodPath || mode === undefined) {
        return NextResponse.json({ error: "path and mode are required for chmod" }, { status: 400 });
      }
      const fullPath = resolveAccessPath(chmodPath, { isAdmin, allowRoot: rootMode });
      let parsedMode: number;
      if (typeof mode === "number") parsedMode = mode;
      else parsedMode = parseInt(String(mode), 8);
      if (Number.isNaN(parsedMode) || parsedMode < 0 || parsedMode > 0o7777) {
        return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
      }
      await fs.chmod(fullPath, parsedMode);
      const stats = await fs.stat(fullPath);
      return NextResponse.json({
        success: true,
        message: `Permissions updated to ${(parsedMode & 0o7777).toString(8)}`,
        mode: (stats.isDirectory() ? "d" : "-") + formatMode(stats.mode),
        modeCode: modeString(stats.mode),
      });
    }

    if (!oldPath || !newPath) {
      return NextResponse.json({ error: "oldPath and newPath are required for rename" }, { status: 400 });
    }

    const fullOldPath = resolveAccessPath(oldPath, { isAdmin, allowRoot: rootMode });
    const fullNewPath = resolveAccessPath(newPath, { isAdmin, allowRoot: rootMode });

    if (isProtectedSystemPath(fullOldPath)) {
      return NextResponse.json({ error: "Refusing to rename a protected system path" }, { status: 400 });
    }

    try {
      await fs.access(fullOldPath);
    } catch {
      return NextResponse.json({ error: "Source file does not exist" }, { status: 404 });
    }

    await fs.mkdir(path.dirname(fullNewPath), { recursive: true });
    await fs.rename(fullOldPath, fullNewPath);

    return NextResponse.json({ success: true, message: `Renamed to ${path.basename(fullNewPath)}`, path: rootMode ? fullNewPath.replace(/\\/g, "/") : path.relative(WORKSPACE_ROOT, fullNewPath).replace(/\\/g, "/") });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files] PUT error:", error.message);
    return NextResponse.json({ error: "Failed to rename file" }, { status: 500 });
  }
}