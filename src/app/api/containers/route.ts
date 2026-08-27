import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";

export async function GET() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({ containers: [] });
    }

    const rawContainers = await docker.listContainers({ all: true });

    const containers = rawContainers.map((c) => {
      const name = c.Names[0]?.replace(/^\//, "") || "container";
      const isManaged = c.Labels?.["cowbox.managed"] === "true" || c.Labels?.["dekployer.managed"] === "true";
      const appName = c.Labels?.["cowbox.app"] || c.Labels?.["dekployer.app"] || null;
      const dbName = c.Labels?.["cowbox.database"] || c.Labels?.["dekployer.database"] || null;
      const dbType = c.Labels?.["cowbox.dbtype"] || c.Labels?.["dekployer.dbtype"] || null;

      let category = "standalone";
      if (appName) category = "application";
      else if (dbName) category = "database";
      else if (name.includes("traefik")) category = "proxy";
      else if (name.includes("gui") || name.includes("adminer") || name.includes("redis-commander")) category = "manager";

      return {
        id: c.Id,
        shortId: c.Id.substring(0, 12),
        name,
        image: c.Image,
        command: c.Command,
        created: c.Created,
        state: c.State,
        status: c.Status,
        ports: c.Ports || [],
        isManaged,
        category,
        appName,
        dbName,
        dbType,
      };
    });

    return NextResponse.json({ containers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, containers: [] }, { status: 500 });
  }
}
