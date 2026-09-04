import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendNotificationToChannel } from "@/lib/notifications/dispatcher";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.webhookUrl !== undefined) updateData.webhookUrl = body.webhookUrl;
    if (body.events !== undefined) updateData.events = body.events;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;

    await db.update(notifications).set(updateData).where(eq(notifications.id, id));
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    await db.delete(notifications).where(eq(notifications.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const [channel] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await sendNotificationToChannel(channel, {
      title: "Test Notification",
      message: `Test message from Cowbox PaaS sent to "${channel.name}" (${channel.channel}).`,
      status: "success",
      appName: "Cowbox",
      event: "test:event",
    });

    return NextResponse.json({ ok: true, message: `Test notification sent to ${channel.name}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to send test notification" }, { status: 500 });
  }
}
