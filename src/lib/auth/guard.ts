import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyApiRequest } from "@/lib/auth/api-key";

/** Permissions granted to built-in roles. `full_access` is admin-only and is never in these sets. */
const ROLE_GRANTS: Record<string, ReadonlySet<string>> = {
  admin: new Set(["full_access"]),
  member: new Set([
    "files:read", "files:write",
    "apps:read", "apps:write", "deploy:write",
    "containers:read", "containers:write",
    "databases:read", "databases:write",
    "cron:read", "cron:write",
    "domains:read", "domains:write",
    "volumes:read", "volumes:write",
    "networks:read", "networks:write",
    "monitoring:read",
    "api-keys:read",
    "audit:read",
  ]),
  viewer: new Set([
    "files:read",
    "apps:read",
    "containers:read",
    "databases:read",
    "cron:read",
    "domains:read",
    "volumes:read",
    "networks:read",
    "monitoring:read",
  ]),
};

function sessionHasPermission(role: string | undefined, requiredPermission: string): boolean {
  if (role === "admin") return true;
  if (requiredPermission === "full_access") return false;
  const grants = ROLE_GRANTS[role ?? ""] || new Set<string>();
  return grants.has(requiredPermission);
}

export async function requireAuth(
  req: Request,
  requiredPermission = "full_access"
): Promise<{ authenticated: boolean; user?: any; response?: NextResponse }> {
  try {
    await initializeDatabase();

    // 1. Check session cookie
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/cowbox-session=([^;]+)/);
    const sessionToken = match ? match[1] : null;

    if (sessionToken) {
      const [session] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.token, sessionToken))
        .limit(1);

      if (session && new Date(session.expiresAt) > new Date()) {
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1);

        if (user) {
          if (!sessionHasPermission(user.role, requiredPermission)) {
            return {
              authenticated: false,
              response: NextResponse.json(
                { error: `Forbidden: role '${user.role}' is not permitted to perform this action` },
                { status: 403 }
              ),
            };
          }
          return { authenticated: true, user };
        }
      }
    }

    // 2. Check API Key
    const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key");
    if (authHeader) {
      const apiResult = await verifyApiRequest(req, requiredPermission);
      if (apiResult.valid) {
        return {
          authenticated: true,
          user: { role: "api_key", name: apiResult.keyRecord?.name || "API Key" },
        };
      }
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: apiResult.error || "Unauthorized API Key" },
          { status: 401 }
        ),
      };
    }

    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Unauthorized: Valid session or API key required" },
        { status: 401 }
      ),
    };
  } catch (error: any) {
    console.error("[Auth] Authentication check failed:", error.message);
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Authentication check failed" },
        { status: 500 }
      ),
    };
  }
}