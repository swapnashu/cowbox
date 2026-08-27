import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";

export async function GET(
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

    if (!app.containerId) {
      return NextResponse.json({ logs: "No active container running for this application." });
    }

    const container = docker.getContainer(app.containerId);
    const logBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail: 250,
      timestamps: true,
    });

    // Clean docker header bytes if returned as raw buffer
    let rawLogs = "";
    if (Buffer.isBuffer(logBuffer)) {
      rawLogs = logBuffer.toString("utf-8");
      // Remove docker 8-byte stream header headers if present
      rawLogs = rawLogs.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    } else {
      rawLogs = String(logBuffer);
    }

    return NextResponse.json({ logs: rawLogs || "No logs available." });
  } catch (error: any) {
    return NextResponse.json({
      logs: `Could not stream container logs: ${error.message}`,
    });
  }
}
