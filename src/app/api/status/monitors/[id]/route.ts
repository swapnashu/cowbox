import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { statusMonitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const body = await req.json();
    
    const allowedFields = ["name", "url", "type", "containerId", "expectedStatusCode", "intervalSeconds", "enabled"];
    const sanitized: Record<string, any> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) sanitized[key] = body[key];
    }
    
    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await db
      .update(statusMonitors)
      .set(sanitized)
      .where(eq(statusMonitors.id, params.id));
      
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    await db.delete(statusMonitors).where(eq(statusMonitors.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
