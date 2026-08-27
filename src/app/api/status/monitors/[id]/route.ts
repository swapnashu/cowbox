import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { statusMonitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const body = await req.json();
    
    await db
      .update(statusMonitors)
      .set(body)
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
    await initializeDatabase();
    await db.delete(statusMonitors).where(eq(statusMonitors.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
