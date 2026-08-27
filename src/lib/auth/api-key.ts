import crypto from "crypto";
import { db, initializeDatabase } from "@/lib/db";
import { apiKeys, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  // Generate 32 bytes of cryptographic randomness
  const secret = crypto.randomBytes(24).toString("hex");
  const rawKey = `cbx_live_${secret}`;
  const keyPrefix = rawKey.substring(0, 16);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  return { rawKey, keyPrefix, keyHash };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function verifyApiRequest(
  req: Request,
  requiredPermission = "deploy:write"
): Promise<{ valid: boolean; error?: string; keyRecord?: any }> {
  await initializeDatabase();

  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
  let token = "";

  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    token = authHeader.trim();
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  if (!token) {
    // Log unauthorized attempt
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      action: "API_UNAUTHORIZED_ACCESS",
      entityType: "api_key",
      details: `Attempt without Authorization header to ${req.url}`,
      ipAddress: clientIp,
      status: "unauthorized",
    });
    return { valid: false, error: "Missing Authorization Bearer token or X-API-Key header" };
  }

  const tokenHash = hashApiKey(token);
  const allKeys = await db.select().from(apiKeys);
  const matchedKey = allKeys.find((k) => k.keyHash === tokenHash);

  if (!matchedKey) {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      action: "API_INVALID_KEY",
      entityType: "api_key",
      details: `Invalid API key attempt to ${req.url}`,
      ipAddress: clientIp,
      status: "unauthorized",
    });
    return { valid: false, error: "Invalid API key" };
  }

  // Check expiration if set
  if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  // Check permissions
  const permissions = matchedKey.permissions.split(",").map((p) => p.trim());
  const hasAccess =
    permissions.includes("full_access") ||
    permissions.includes(requiredPermission) ||
    (requiredPermission.startsWith("apps:") && permissions.includes("apps:write"));

  if (!hasAccess) {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      action: "API_FORBIDDEN_PERMISSION",
      entityType: "api_key",
      entityId: matchedKey.id,
      details: `Key ${matchedKey.name} lacked required permission: ${requiredPermission}`,
      ipAddress: clientIp,
      status: "unauthorized",
    });
    return { valid: false, error: `Forbidden: API key lacks required '${requiredPermission}' permission` };
  }

  // Update last used timestamp
  const now = new Date().toISOString();
  await db
    .update(apiKeys)
    .set({ lastUsedAt: now })
    .where(eq(apiKeys.id, matchedKey.id));

  // Log successful API call
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    action: "API_AUTHENTICATED_REQUEST",
    entityType: "api_key",
    entityId: matchedKey.id,
    details: `Authorized '${matchedKey.name}' for ${req.url}`,
    ipAddress: clientIp,
    status: "success",
  });

  return { valid: true, keyRecord: matchedKey };
}
