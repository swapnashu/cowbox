import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { cronJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { exec } from "child_process";
import { requireAuth } from "@/lib/auth/guard";

function isPrivateIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|::1|fc|fd)/.test(ip);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, params.id));

    if (!job) {
      return NextResponse.json({ error: "Cron job not found" }, { status: 404 });
    }

    let output = "";
    let success = true;

    if (job.targetType === "http") {
      try {
        const urlObj = new URL(job.command);
        if (isPrivateIP(urlObj.hostname)) {
          return NextResponse.json({ error: "HTTP target resolves to private IP" }, { status: 400 });
        }
        const res = await fetch(job.command, { method: "GET" });
        output = `HTTP ${res.status} ${res.statusText}`;
        success = res.ok;
      } catch (err: any) {
        output = `HTTP Error: ${err.message}`;
        success = false;
      }
    } else {
      output = await new Promise<string>((resolve) => {
        exec(job.command, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            success = false;
            resolve(`Error (code ${error.code}): ${stderr || error.message}`);
          } else {
            resolve(stdout || "Executed with code 0 (no output)");
          }
        });
      });
    }

    const runTimestamp = new Date().toISOString();
    await db
      .update(cronJobs)
      .set({
        lastRun: runTimestamp,
        lastStatus: success ? "success" : "failed",
        logs: `[${runTimestamp}] ${output}`,
      })
      .where(eq(cronJobs.id, job.id));

    return NextResponse.json({
      success,
      output,
      lastRun: runTimestamp,
    });
  } catch (error: any) {
    console.error("[Cron] Run error:", error.message);
    return NextResponse.json({ error: "Failed to execute cron job" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    await db.delete(cronJobs).where(eq(cronJobs.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Cron] Delete error:", error.message);
    return NextResponse.json({ error: "Failed to delete cron job" }, { status: 500 });
  }
}
