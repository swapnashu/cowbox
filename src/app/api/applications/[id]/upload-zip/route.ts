import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, deployments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";

const buildsBaseDir = path.join(process.cwd(), "data", "builds");
if (!fs.existsSync(buildsBaseDir)) {
  fs.mkdirSync(buildsBaseDir, { recursive: true });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No ZIP file provided in upload" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const appBuildDir = path.join(buildsBaseDir, app.id);
    if (fs.existsSync(appBuildDir)) {
      fs.rmSync(appBuildDir, { recursive: true, force: true });
    }
    fs.mkdirSync(appBuildDir, { recursive: true });

    // Extract zip contents
    const zip = new AdmZip(buffer);
    zip.extractAllTo(appBuildDir, true);

    const extractedFiles = fs.readdirSync(appBuildDir);
    const hasDockerfile = fs.existsSync(path.join(appBuildDir, "Dockerfile"));
    const hasPackageJson = fs.existsSync(path.join(appBuildDir, "package.json"));

    // Update app record to reflect ZIP upload
    await db
      .update(applications)
      .set({
        appType: hasDockerfile ? "dockerfile" : "image",
        buildPath: appBuildDir,
        description: `Deployed from ZIP: ${file.name} (${extractedFiles.length} files extracted)`,
      })
      .where(eq(applications.id, app.id));

    // Trigger deployment
    const deployUrl = new URL(`/api/applications/${params.id}/deploy`, req.url);
    const deployRes = await fetch(deployUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const deployResult = await deployRes.json();

    return NextResponse.json({
      success: true,
      message: `Extracted ${extractedFiles.length} files from ${file.name} and triggered build`,
      hasDockerfile,
      hasPackageJson,
      deployment: deployResult,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
