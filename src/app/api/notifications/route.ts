import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  try {
    const channels = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
    return NextResponse.json(channels);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { channel, name, webhookUrl, events } = await req.json();
    if (!channel || !name || !webhookUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const newChannel = {
      id,
      channel,
      name,
      webhookUrl,
      events: events || "deploy:success,deploy:failed,container:stopped",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    await db.insert(notifications).values(newChannel);

    return NextResponse.json(newChannel, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
