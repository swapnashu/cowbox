import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    await db.delete(domains).where(eq(domains.id, params.id));
    return NextResponse.json({ success: true, message: "Domain removed successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
