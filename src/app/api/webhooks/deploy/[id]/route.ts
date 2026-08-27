import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, deployments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const commitMsg = payload.head_commit?.message || "Webhook trigger (Git Push)";
    const commitHash = payload.head_commit?.id?.substring(0, 7) || "latest";

    // Trigger internal deploy endpoint
    const deployUrl = new URL(`/api/applications/${params.id}/deploy`, req.url);
    const deployRes = await fetch(deployUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const result = await deployRes.json();

    return NextResponse.json({
      success: true,
      message: `Automatic deployment triggered for ${app.name} (${commitHash}: ${commitMsg})`,
      deployment: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
