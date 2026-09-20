import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";
import { requireAuth } from "@/lib/auth/guard";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authenticated) return auth.response!;
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (!app.containerId) {
      return NextResponse.json({ error: "No container associated with this application" }, { status: 400 });
    }

    const container = docker.getContainer(app.containerId);
    await container.restart();

    await db
      .update(applications)
      .set({ status: "running" })
      .where(eq(applications.id, app.id));

    return NextResponse.json({ success: true, message: "Container restarted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
