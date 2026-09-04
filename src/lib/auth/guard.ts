import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyApiRequest } from "@/lib/auth/api-key";

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
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Authentication check failed: " + error.message },
        { status: 500 }
      ),
    };
  }
}
