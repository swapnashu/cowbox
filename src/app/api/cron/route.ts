import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { cronJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  try {
    await initializeDatabase();
    const jobs = await db.select().from(cronJobs);
    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initializeDatabase();
    const { name, schedule, targetType = "shell", command } = await req.json();

    if (!name || !schedule || !command) {
      return NextResponse.json({ error: "Name, schedule expression, and command are required" }, { status: 400 });
    }

    const newJobId = crypto.randomUUID();
    await db.insert(cronJobs).values({
      id: newJobId,
      name,
      schedule,
      targetType,
      command,
      enabled: true,
      lastStatus: "never",
      logs: "Job created. Ready to run.",
    });

    const [created] = await db.select().from(cronJobs).where(eq(cronJobs.id, newJobId));
    return NextResponse.json({ success: true, job: created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
