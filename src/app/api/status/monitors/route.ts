import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { statusMonitors } from "@/lib/db/schema";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    await initializeDatabase();
    const monitors = await db.select().from(statusMonitors);
    return NextResponse.json(monitors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initializeDatabase();
    const body = await req.json();
    
    const id = crypto.randomUUID();
    await db.insert(statusMonitors).values({
      id,
      name: body.name,
      url: body.url,
      type: body.type,
      containerId: body.containerId,
      expectedStatusCode: body.expectedStatusCode || 200,
      intervalSeconds: body.intervalSeconds || 60,
      enabled: body.enabled !== false,
    });
    
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
