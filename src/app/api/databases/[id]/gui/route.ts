import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { databases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker, ensureCowboxNetwork, COWBOX_NETWORK, buildTraefikLabels } from "@/lib/docker";
import { generateSslipDomain } from "@/lib/domain";
import os from "os";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, params.id));

    if (!database) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    await ensureCowboxNetwork();

    let serverIp = "127.0.0.1";
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
          if (net.family === "IPv4" && !net.internal) {
            serverIp = net.address;
            break;
          }
        }
      }
    } catch (e) {}

    const guiContainerName = `cowbox-gui-${database.name}`;
    const guiDomain = generateSslipDomain(`admin-${database.name}`, serverIp);

    const containers = await docker.listContainers({ all: true });
    const existing = containers.find((c) =>
      c.Names.some((n) => n.includes(guiContainerName) || n.includes(`dekployer-gui-${database.name}`))
    );

    if (existing) {
      const containerObj = docker.getContainer(existing.Id);
      if (existing.State !== "running") {
        await containerObj.start();
      }
      return NextResponse.json({
        success: true,
        url: `http://${guiDomain}`,
        containerId: existing.Id,
        message: "Adminer database GUI is running",
      });
    }

    let image = "adminer:latest";
    let port = 8080;
    const env: string[] = [];

    if (database.type === "redis") {
      image = "rediscommander/redis-commander:latest";
      port = 8081;
      env.push(`REDIS_HOSTS=local:cowbox-db-${database.name}:${database.internalPort}`);
    }

    try {
      await docker.pull(image);
    } catch (e) {}

    const traefikLabels = buildTraefikLabels({
      appName: `admin-${database.name}`,
      domains: [{ domain: guiDomain, https: false, certificateResolver: "none" }],
      containerPort: port,
    });

    const container = await docker.createContainer({
      Image: image,
      name: guiContainerName,
      Env: env,
      Labels: traefikLabels,
      HostConfig: {
        NetworkMode: COWBOX_NETWORK,
        RestartPolicy: { Name: "unless-stopped" },
      },
    });

    await container.start();

    return NextResponse.json({
      success: true,
      url: `http://${guiDomain}`,
      containerId: container.id,
      message: "Adminer database web manager launched successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
