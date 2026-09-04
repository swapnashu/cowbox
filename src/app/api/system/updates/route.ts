import { NextRequest, NextResponse } from "next/server";
import { checkForUpdates } from "@/lib/updater";
import { dispatchEvent } from "@/lib/notifications/dispatcher";
import { db, initializeDatabase } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const updateInfo = await checkForUpdates(force);
    return NextResponse.json(updateInfo);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to check for updates" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await initializeDatabase();
    const updateInfo = await checkForUpdates(true);

    if (updateInfo.hasUpdate) {
      await dispatchEvent("system:update_available", {
        title: `🚀 Cowbox Update Available (${updateInfo.latestVersion})`,
        message: `A new version of Cowbox is available (Current: v${updateInfo.currentVersion} -> Latest: v${updateInfo.latestVersion}). Run: ${updateInfo.instructions.pip}`,
        status: "warning",
      });

      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        action: "UPDATE_AVAILABLE_DETECTED",
        entityType: "system",
        details: `Discovered new version v${updateInfo.latestVersion} (current: v${updateInfo.currentVersion})`,
        status: "success",
      });
    }

    return NextResponse.json({
      success: true,
      updateInfo,
      message: updateInfo.hasUpdate
        ? `Update v${updateInfo.latestVersion} is available!`
        : `Cowbox is already up to date (v${updateInfo.currentVersion}).`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process update request" },
      { status: 500 }
    );
  }
}
