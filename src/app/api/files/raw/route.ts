import { NextResponse } from "next/server";
import { resolveAccessPath, AccessDeniedError } from "@/lib/workspace";
import * as fs from "fs/promises";
import { createReadStream } from "fs";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

const INLINE_MAX = 25 * 1024 * 1024; // inline preview cap; downloads stream any size

function contentTypeFor(ext: string): string {
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".svg": return "image/svg+xml";
    case ".webp": return "image/webp";
    case ".pdf": return "application/pdf";
    case ".json": return "application/json";
    case ".txt": case ".log": case ".md": return "text/plain";
    case ".zip": return "application/zip";
    default: return "application/octet-stream";
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, "files:read");
    if (!auth.authenticated) return auth.response!;
    const { searchParams } = new URL(req.url);
    const subPath = searchParams.get("path");
    const isAdmin = auth.user?.role === "admin";
    const rootMode = (searchParams.get("root") === "1" || searchParams.get("root") === "true") && isAdmin;
    const asDownload = searchParams.get("download") === "1";
    if (!subPath) return new NextResponse("Missing path", { status: 400 });

    const fullPath = resolveAccessPath(subPath, { isAdmin, allowRoot: rootMode });

    try {
      await fs.access(fullPath);
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      return new NextResponse("Path is a directory", { status: 400 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const filename = encodeURIComponent(path.basename(fullPath));
    const headers: Record<string, string> = {
      "Content-Length": stat.size.toString(),
      "Content-Disposition": asDownload
        ? `attachment; filename*=UTF-8''${filename}`
        : `inline; filename*=UTF-8''${filename}`,
    };

    // Small files (inline or download) are handed back directly from buffer.
    if (stat.size <= INLINE_MAX) {
      headers["Content-Type"] = contentTypeFor(ext);
      const buffer = await fs.readFile(fullPath);
      return new NextResponse(buffer, { headers });
    }

    // Large downloads stream from disk (any size).
    headers["Content-Type"] = "application/octet-stream";
    const nodeStream = createReadStream(fullPath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new NextResponse(webStream as unknown as BodyInit, { headers });
  } catch (err: any) {
    if (err instanceof AccessDeniedError) {
      return new NextResponse(err.message, { status: 403 });
    }
    console.error("[Files/Raw] GET error:", err.message);
    return new NextResponse("Failed to read file", { status: 500 });
  }
}