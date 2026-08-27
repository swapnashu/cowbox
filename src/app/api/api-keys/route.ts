import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { apiKeys, auditLogs } from "@/lib/db/schema";
import { generateApiKey } from "@/lib/auth/api-key";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  try {
    await initializeDatabase();
    const keys = await db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys);

    return NextResponse.json({ keys });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initializeDatabase();
    const { name, permissions = "full_access", expiresAt } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "API Key Name is required" }, { status: 400 });
    }

    const { rawKey, keyPrefix, keyHash } = generateApiKey();
    const keyId = crypto.randomUUID();

    await db.insert(apiKeys).values({
      id: keyId,
      name: name.trim(),
      keyPrefix: `${keyPrefix}...`,
      keyHash,
      permissions,
      expiresAt: expiresAt || null,
    });

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      action: "API_KEY_CREATED",
      entityType: "api_key",
      entityId: keyId,
      details: `Created API key '${name}' with permissions: ${permissions}`,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: "API Key created successfully! Save this secret token now as it will never be displayed again.",
      apiKey: {
        id: keyId,
        name,
        rawKey, // returned ONLY once upon creation!
        keyPrefix: `${keyPrefix}...`,
        permissions,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
