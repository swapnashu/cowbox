import { NextResponse } from "next/server";
import { resolveAccessPath, AccessDeniedError } from "@/lib/workspace";
import * as fs from "fs/promises";
import { requireAuth } from "@/lib/auth/guard";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, "files:write");
    if (!auth.authenticated) return auth.response!;
    const { dirPath, root } = await req.json();
    if (!dirPath || dirPath.trim() === "") {
      return NextResponse.json({ error: "Directory path is required" }, { status: 400 });
    }

    const fullPath = resolveAccessPath(dirPath, { isAdmin: auth.user?.role === "admin", allowRoot: !!root && auth.user?.role === "admin" });

    try {
      await fs.access(fullPath);
      return NextResponse.json({ error: "Directory already exists" }, { status: 400 });
    } catch {
      // Directory doesn't exist, which is what we want
    }

    await fs.mkdir(fullPath, { recursive: true });

    return NextResponse.json({ success: true, message: `Directory created: ${dirPath}` });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files/Mkdir] POST error:", error.message);
    return NextResponse.json({ error: "Failed to create directory" }, { status: 500 });
  }
}
