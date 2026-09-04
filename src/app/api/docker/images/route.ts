import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";

export async function GET() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({ images: [] });
    }

    const rawImages = await docker.listImages({ all: true });

    const images = rawImages.map((img) => {
      const tags = img.RepoTags || [];
      const isDangling = !img.RepoTags || img.RepoTags.includes("<none>:<none>");
      const shortId = img.Id.replace(/^sha256:/, "").substring(0, 12);
      const primaryTag = tags.length > 0 && !tags[0].includes("<none>") ? tags[0] : `layer:${shortId}`;

      return {
        id: img.Id,
        shortId,
        tags,
        primaryTag,
        sizeBytes: img.Size,
        created: img.Created,
        isDangling,
        containers: img.Containers,
        labels: img.Labels || {},
      };
    });

    return NextResponse.json({ images });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, images: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image || !image.trim()) {
      return NextResponse.json({ error: "Image name is required" }, { status: 400 });
    }

    const imageName = image.trim();
    
    // Pull image with promise stream
    await new Promise((resolve, reject) => {
      docker.pull(imageName, (err: any, stream: any) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, onFinished, onProgress);

        function onFinished(err: any, output: any) {
          if (err) return reject(err);
          resolve(output);
        }
        function onProgress(event: any) {}
      });
    });

    return NextResponse.json({
      success: true,
      message: `Image "${imageName}" pulled successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("id");
    const pruneDangling = searchParams.get("dangling") === "true";

    if (pruneDangling) {
      const result = await docker.pruneImages({ filters: { dangling: { true: true } } });
      const count = (result as any)?.ImagesDeleted?.length || 0;
      return NextResponse.json({
        success: true,
        message: `Pruned ${count} dangling image layers`,
        count,
      });
    }

    if (!imageId) {
      return NextResponse.json({ error: "Image ID or dangling query param is required" }, { status: 400 });
    }

    const imgObj = docker.getImage(imageId);
    await imgObj.remove({ force: true });

    return NextResponse.json({
      success: true,
      message: `Image ${imageId.substring(0, 12)} removed successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
