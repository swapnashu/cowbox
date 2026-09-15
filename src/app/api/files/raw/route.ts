import { NextResponse } from "next/server";
import { resolveSafePath } from "@/lib/workspace";
import * as fs from "fs";
import * as path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subPath = searchParams.get("path");
    if (!subPath) return new NextResponse("Missing path", { status: 400 });

    const fullPath = resolveSafePath(subPath);
    if (!fs.existsSync(fullPath)) return new NextResponse("Not found", { status: 404 });

    const stat = fs.statSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    
    let contentType = "application/octet-stream";
    if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (ext === ".webp") contentType = "image/webp";

    const stream = fs.createReadStream(fullPath);
    
    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString()
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
