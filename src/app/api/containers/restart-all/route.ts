import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";

export async function POST() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({ error: "Docker daemon not connected" }, { status: 500 });
    }

    const containers = await docker.listContainers({ all: false }); // only running containers
    let restarted = 0;

    for (const c of containers) {
      try {
        const container = docker.getContainer(c.Id);
        await container.restart();
        restarted++;
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      message: `Successfully restarted ${restarted} running container${restarted === 1 ? "" : "s"}`,
      restartedCount: restarted,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
