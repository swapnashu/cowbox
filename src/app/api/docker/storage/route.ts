import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";

export async function GET() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({ volumes: [], images: [], networks: [] });
    }

    const [volumesData, imagesData, networksData] = await Promise.all([
      docker.listVolumes().catch(() => ({ Volumes: [] })),
      docker.listImages().catch(() => []),
      docker.listNetworks().catch(() => []),
    ]);

    const volumes = (volumesData?.Volumes || []).map((v: any) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      scope: v.Scope,
      createdAt: v.CreatedAt,
      labels: v.Labels || {},
    }));

    const images = imagesData.map((img: any) => ({
      id: img.Id.substring(7, 19),
      tags: img.RepoTags || ["<none>"],
      sizeBytes: img.Size,
      created: img.Created,
    }));

    const networks = networksData.map((n: any) => ({
      id: n.Id.substring(0, 12),
      name: n.Name,
      driver: n.Driver,
      scope: n.Scope,
      containersCount: Object.keys(n.Containers || {}).length,
    }));

    return NextResponse.json({
      volumes,
      images,
      networks,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
