import { NextResponse } from "next/server";
import { resolveSafePath } from "@/lib/workspace";
import * as fs from "fs";

export async function POST(req: Request) {
  try {
    const { dirPath } = await req.json();
    if (!dirPath || dirPath.trim() === "") {
      return NextResponse.json({ error: "Directory path is required" }, { status: 400 });
    }

    const fullPath = resolveSafePath(dirPath);

    if (fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "Directory already exists" }, { status: 400 });
    }

    fs.mkdirSync(fullPath, { recursive: true });

    return NextResponse.json({ success: true, message: `Directory created: ${dirPath}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
