import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";

export async function GET() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({ volumes: [] });
    }

    const [volumesData, containersData] = await Promise.all([
      docker.listVolumes(),
      docker.listContainers({ all: true }).catch(() => []),
    ]);

    const rawVolumes = volumesData.Volumes || [];

    const volumes = rawVolumes.map((v) => {
      // Find containers using this volume
      const attachedContainers = containersData
        .filter((c) =>
          (c.Mounts || []).some((m: any) => m.Name === v.Name || m.Source?.includes(v.Name))
        )
        .map((c) => ({
          id: c.Id.substring(0, 12),
          name: c.Names[0]?.replace(/^\//, "") || "container",
          state: c.State,
        }));

      return {
        name: v.Name,
        driver: v.Driver,
        mountpoint: v.Mountpoint,
        scope: v.Scope,
        createdAt: (v as any).CreatedAt || null,
        labels: v.Labels || {},
        attachedContainers,
        isInUse: attachedContainers.length > 0,
      };
    });

    return NextResponse.json({ volumes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, volumes: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, driver = "local", labels = {} } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Volume name is required" }, { status: 400 });
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");

    const volume = await docker.createVolume({
      Name: cleanName,
      Driver: driver,
      Labels: {
        ...labels,
        "cowbox.managed": "true",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Volume "${cleanName}" created successfully`,
      volume,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const volumeName = searchParams.get("name");
    const pruneUnused = searchParams.get("prune") === "true";

    if (pruneUnused) {
      const result = await docker.pruneVolumes();
      const count = (result as any)?.VolumesDeleted?.length || 0;
      return NextResponse.json({
        success: true,
        message: `Pruned ${count} unused volumes`,
        count,
      });
    }

    if (!volumeName) {
      return NextResponse.json({ error: "Volume name is required" }, { status: 400 });
    }

    const volObj = docker.getVolume(volumeName);
    await volObj.remove({ force: true });

    return NextResponse.json({
      success: true,
      message: `Volume "${volumeName}" removed successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
