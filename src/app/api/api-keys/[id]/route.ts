import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { apiKeys, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, params.id));

    if (!key) {
      return NextResponse.json({ error: "API Key not found" }, { status: 404 });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, params.id));

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      action: "API_KEY_REVOKED",
      entityType: "api_key",
      entityId: params.id,
      details: `Revoked API key '${key.name}'`,
      status: "success",
    });

    return NextResponse.json({ success: true, message: `Revoked API Key '${key.name}'` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
