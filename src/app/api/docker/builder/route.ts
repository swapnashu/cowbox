import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";

export async function GET() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({
        connected: false,
        totalBytes: 0,
        reclaimableBytes: 0,
        layersCount: 0,
        items: [],
      });
    }

    let dfData: any = null;
    try {
      dfData = await docker.df();
    } catch (e) {}

    const buildCache = dfData?.BuildCache || [];
    let totalBytes = 0;
    let reclaimableBytes = 0;

    const items = buildCache.map((item: any) => {
      const size = item.Size || 0;
      totalBytes += size;
      if (!item.InUse) {
        reclaimableBytes += size;
      }

      return {
        id: item.ID?.substring(0, 16) || "layer",
        type: item.Type || "regular",
        description: item.Description || "Build cache snapshot",
        inUse: Boolean(item.InUse),
        shared: Boolean(item.Shared),
        sizeBytes: size,
        lastUsedAt: item.LastUsedAt,
        usageCount: item.UsageCount || 0,
      };
    });

    // Also include image layers summary
    const images = dfData?.Images || [];
    let imagesTotalBytes = 0;
    let imagesReclaimableBytes = 0;

    images.forEach((img: any) => {
      imagesTotalBytes += img.Size || 0;
      if (img.Containers === 0 || !img.Containers) {
        imagesReclaimableBytes += img.Size || 0;
      }
    });

    return NextResponse.json({
      connected: true,
      totalBytes,
      reclaimableBytes,
      layersCount: items.length,
      items,
      imagesStats: {
        totalBytes: imagesTotalBytes,
        reclaimableBytes: imagesReclaimableBytes,
        count: images.length,
      },
      containersCount: dfData?.Containers?.length || 0,
      volumesCount: dfData?.Volumes?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { keepStorage = 0, pruneAll = true } = await req.json().catch(() => ({}));

    // Prune BuildKit cache
    let pruneResult: any = { CachesDeleted: [], SpaceReclaimed: 0 };
    try {
      if (typeof (docker as any).pruneBuilder === "function") {
        pruneResult = await (docker as any).pruneBuilder({
          keepStorage,
          all: pruneAll,
        });
      }
    } catch {
      pruneResult = { CachesDeleted: [], SpaceReclaimed: 0 };
    }

    const spaceReclaimed = (pruneResult as any)?.SpaceReclaimed || 0;
    const cachesDeletedCount = (pruneResult as any)?.CachesDeleted?.length || 0;

    return NextResponse.json({
      success: true,
      message: `Build cache pruned successfully. Reclaimed ${(spaceReclaimed / (1024 * 1024)).toFixed(1)} MB across ${cachesDeletedCount} layer(s).`,
      spaceReclaimedBytes: spaceReclaimed,
      cachesDeletedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
