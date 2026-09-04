import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications, appVolumes, volumes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function GET(
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

    const attachedVolumes = await db
      .select()
      .from(appVolumes)
      .where(eq(appVolumes.applicationId, params.id));

    return NextResponse.json({ volumes: attachedVolumes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    const { volumeName: rawVolumeName, mountPath: rawMountPath } = await req.json();

    if (!rawVolumeName || !rawMountPath) {
      return NextResponse.json(
        { error: "volumeName and mountPath are required" },
        { status: 400 }
      );
    }

    const volumeName = rawVolumeName.trim();
    const mountPath = rawMountPath.trim();

    // Ensure volume exists in volumes table
    const existingVol = await db
      .select()
      .from(volumes)
      .where(eq(volumes.name, volumeName));

    if (existingVol.length === 0) {
      await db.insert(volumes).values({
        id: crypto.randomUUID(),
        name: volumeName,
        driver: "local",
      });
    }

    // Check if attachment already exists
    const existingAppVol = await db
      .select()
      .from(appVolumes)
      .where(
        and(
          eq(appVolumes.applicationId, params.id),
          eq(appVolumes.volumeName, volumeName)
        )
      );

    if (existingAppVol.length > 0) {
      // Update mount path
      await db
        .update(appVolumes)
        .set({ mountPath })
        .where(eq(appVolumes.id, existingAppVol[0].id));

      return NextResponse.json({
        success: true,
        message: "Volume mount path updated",
        volume: { ...existingAppVol[0], mountPath },
      });
    }

    const newAppVolId = crypto.randomUUID();
    await db.insert(appVolumes).values({
      id: newAppVolId,
      applicationId: params.id,
      volumeName,
      mountPath,
    });

    const [created] = await db
      .select()
      .from(appVolumes)
      .where(eq(appVolumes.id, newAppVolId));

    return NextResponse.json(
      { success: true, message: "Volume attached successfully", volume: created },
      { status: 201 }
    );
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
    const { searchParams } = new URL(req.url);
    const volumeId = searchParams.get("volumeId");
    const volumeName = searchParams.get("volumeName");

    if (volumeId) {
      await db
        .delete(appVolumes)
        .where(
          and(
            eq(appVolumes.id, volumeId),
            eq(appVolumes.applicationId, params.id)
          )
        );
    } else if (volumeName) {
      await db
        .delete(appVolumes)
        .where(
          and(
            eq(appVolumes.volumeName, volumeName),
            eq(appVolumes.applicationId, params.id)
          )
        );
    } else {
      return NextResponse.json(
        { error: "Must provide volumeId or volumeName to detach volume" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Volume detached successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
