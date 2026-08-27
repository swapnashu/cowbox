import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { cronJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { exec } from "child_process";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [job] = await db.select().from(cronJobs).where(eq(cronJobs.id, params.id));

    if (!job) {
      return NextResponse.json({ error: "Cron job not found" }, { status: 404 });
    }

    let output = "";
    let success = true;

    if (job.targetType === "http") {
      try {
        const res = await fetch(job.command, { method: "GET" });
        output = `HTTP ${res.status} ${res.statusText}`;
        success = res.ok;
      } catch (err: any) {
        output = `HTTP Error: ${err.message}`;
        success = false;
      }
    } else {
      // Execute shell command
      output = await new Promise<string>((resolve) => {
        exec(job.command, { timeout: 30000 }, (error, stdout, stderr) => {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    await db.delete(cronJobs).where(eq(cronJobs.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
