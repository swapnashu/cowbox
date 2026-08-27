import { NextResponse } from "next/server";
import { resolveSafePath, WORKSPACE_ROOT } from "@/lib/workspace";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const targetDirRel = (formData.get("targetDir") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const targetDir = resolveSafePath(targetDirRel);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      message: `Uploaded ${file.name} successfully`,
      filename: file.name,
      sizeBytes: file.size,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
