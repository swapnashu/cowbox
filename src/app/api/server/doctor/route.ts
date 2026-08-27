import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";
import { db, initializeDatabase } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import crypto from "crypto";

export async function GET() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({
        healthy: false,
        error: "Cannot connect to Docker daemon",
        checks: [],
      });
    }

    const [containers, images, volumesData, dfData] = await Promise.all([
      docker.listContainers({ all: true }).catch(() => []),
      docker.listImages().catch(() => []),
      docker.listVolumes().catch(() => ({ Volumes: [] })),
      docker.df().catch(() => null),
    ]);

    const stoppedContainers = containers.filter((c) => c.State !== "running");
    const danglingImages = images.filter((i) => !i.RepoTags || i.RepoTags.includes("<none>:<none>"));
    const totalVolumes = volumesData?.Volumes || [];

    const checks = [
      {
        name: "Docker Daemon Connection",
        status: "pass",
        message: `Connected (${status.version || "Docker Engine"})`,
      },
      {
        name: "Zombie / Stopped Containers",
        status: stoppedContainers.length > 5 ? "warn" : "pass",
        message: `${stoppedContainers.length} stopped container(s) detected`,
        count: stoppedContainers.length,
      },
      {
        name: "Dangling Unused Images",
        status: danglingImages.length > 0 ? "warn" : "pass",
        message: `${danglingImages.length} dangling image layer(s) ready for cleanup`,
        count: danglingImages.length,
      },
      {
        name: "Persistent Volume Allocations",
        status: "pass",
        message: `${totalVolumes.length} Docker volume(s) actively managed`,
        count: totalVolumes.length,
      },
    ];

    const isAllHealthy = checks.every((c) => c.status === "pass");

    return NextResponse.json({
      healthy: isAllHealthy,
      checks,
      stats: {
        totalContainers: containers.length,
        runningContainers: containers.length - stoppedContainers.length,
        stoppedContainers: stoppedContainers.length,
        totalImages: images.length,
        danglingImages: danglingImages.length,
        totalVolumes: totalVolumes.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    await initializeDatabase();
    // Execute deep prune
    const [prunedContainers, prunedImages, prunedVolumes, prunedBuilder] = await Promise.all([
      docker.pruneContainers().catch(() => ({ ContainersDeleted: [] })),
      docker.pruneImages({ filters: { dangling: { false: true } } }).catch(() => ({ ImagesDeleted: [] })),
      docker.pruneVolumes().catch(() => ({ VolumesDeleted: [] })),
      docker.pruneBuilder().catch(() => null),
    ]);

    const containersCount = (prunedContainers as any)?.ContainersDeleted?.length || 0;
    const imagesCount = (prunedImages as any)?.ImagesDeleted?.length || 0;
    const volumesCount = (prunedVolumes as any)?.VolumesDeleted?.length || 0;

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      action: "SYSTEM_DOCTOR_CLEANUP",
      entityType: "system",
      details: `Self-healing cleaned ${containersCount} containers, ${imagesCount} images, ${volumesCount} volumes`,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: `System Doctor optimized cluster: Removed ${containersCount} stopped containers, ${imagesCount} images, ${volumesCount} unused volumes!`,
      cleaned: {
        containers: containersCount,
        images: imagesCount,
        volumes: volumesCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
