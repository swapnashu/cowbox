import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { composeStacks, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker, ensureCowboxNetwork, COWBOX_NETWORK, pullDockerImage } from "@/lib/docker";
import YAML from "yaml";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    await initializeDatabase();
    const { projectId, name, composeYaml, envVars = "" } = await req.json();

    if (!projectId || !name || !composeYaml) {
      return NextResponse.json({ error: "Project ID, Stack Name, and Compose YAML are required" }, { status: 400 });
    }

    await ensureCowboxNetwork();

    // Parse YAML safely
    let parsed: any;
    try {
      parsed = YAML.parse(composeYaml);
    } catch (e: any) {
      return NextResponse.json({ error: `Invalid YAML syntax: ${e.message}` }, { status: 400 });
    }

    const services = parsed.services || {};
    const serviceNames = Object.keys(services);

    if (serviceNames.length === 0) {
      return NextResponse.json({ error: "No services defined in compose file" }, { status: 400 });
    }

    // Parse env vars
    const envList: string[] = [];
    if (envVars) {
      for (const line of envVars.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          envList.push(trimmed);
        }
      }
    }

    const deployedContainers: string[] = [];

    // Launch each service container in sequence
    for (const sName of serviceNames) {
      const s = services[sName];
      const image = s.image || "nginx:alpine";
      const containerName = `cowbox-stack-${name}-${sName}`;

      try {
        await pullDockerImage(image);
      } catch (e) {}

      // Port mappings if any
      const portBindings: Record<string, Array<{ HostPort: string }>> = {};
      if (s.ports) {
        for (const p of s.ports) {
          const parts = p.toString().split(":");
          if (parts.length === 2) {
            portBindings[`${parts[1]}/tcp`] = [{ HostPort: parts[0] }];
          } else if (parts.length === 3) {
            portBindings[`${parts[2]}/tcp`] = [{ HostPort: parts[1] }];
          }
        }
      }

      // Merge environment
      const serviceEnv: string[] = [...envList];
      if (s.environment) {
        if (Array.isArray(s.environment)) {
          serviceEnv.push(...s.environment);
        } else if (typeof s.environment === "object") {
          for (const [k, v] of Object.entries(s.environment)) {
            serviceEnv.push(`${k}=${v}`);
          }
        }
      }

      // Check if container exists and stop/remove
      const containers = await docker.listContainers({ all: true });
      const existing = containers.find((c) => c.Names.some((n) => n.includes(containerName)));
      if (existing) {
        const cObj = docker.getContainer(existing.Id);
        await cObj.stop().catch(() => {});
        await cObj.remove({ force: true }).catch(() => {});
      }

      const container = await docker.createContainer({
        Image: image,
        name: containerName,
        Env: serviceEnv,
        Labels: {
          "cowbox.managed": "true",
          "cowbox.compose": name,
          "cowbox.service": sName,
        },
        HostConfig: {
          NetworkMode: COWBOX_NETWORK,
          PortBindings: portBindings,
          RestartPolicy: { Name: s.restart || "unless-stopped" },
        },
      });

      await container.start();
      deployedContainers.push(`${sName} (${container.id.substring(0, 12)})`);
    }

    // Persist/Update stack in database
    const existingStack = await db.select().from(composeStacks).where(eq(composeStacks.name, name));
    if (existingStack.length > 0) {
      await db
        .update(composeStacks)
        .set({
          composeYaml,
          envVars,
          status: "running",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(composeStacks.name, name));
    } else {
      await db.insert(composeStacks).values({
        id: crypto.randomUUID(),
        projectId,
        name,
        composeYaml,
        envVars,
        status: "running",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Launched ${deployedContainers.length} services for stack "${name}" successfully`,
      services: deployedContainers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
