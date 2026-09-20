import { NextResponse } from "next/server";
import { resolveAccessPath, AccessDeniedError } from "@/lib/workspace";
import * as fs from "fs/promises";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, "files:write");
    if (!auth.authenticated) return auth.response!;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const targetDirRel = (formData.get("targetDir") as string) || "";
    const rootMode = (formData.get("root") === "1" || formData.get("root") === "true") && auth.user?.role === "admin";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const targetDir = resolveAccessPath(targetDirRel, { isAdmin: auth.user?.role === "admin", allowRoot: rootMode });
    await fs.mkdir(targetDir, { recursive: true });

    const safeFileName = path.basename(file.name);
    if (!safeFileName || safeFileName === "." || safeFileName === "..") {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = resolveAccessPath(path.join(targetDirRel, safeFileName), { isAdmin: auth.user?.role === "admin", allowRoot: rootMode });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      message: `Uploaded ${safeFileName} successfully`,
      filename: safeFileName,
      sizeBytes: file.size,
    });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files/Upload] POST error:", error.message);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
