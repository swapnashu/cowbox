import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";

export async function POST() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({ error: "Docker daemon not connected" }, { status: 500 });
    }

    const [containersPruned, imagesPruned] = await Promise.all([
      docker.pruneContainers().catch(() => ({ ContainersDeleted: [] })),
      docker.pruneImages().catch(() => ({ ImagesDeleted: [] })),
    ]);

    const containersCount = containersPruned?.ContainersDeleted?.length || 0;
    const imagesCount = imagesPruned?.ImagesDeleted?.length || 0;

    return NextResponse.json({
      success: true,
      message: `Pruned ${containersCount} stopped container(s) and ${imagesCount} unused image(s)`,
      containersCount,
      imagesCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
