import { NextResponse } from "next/server";
import { docker } from "@/lib/docker";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req, "containers:read");
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const container = docker.getContainer(params.id);
    const data = await container.inspect();

    return NextResponse.json({
      id: data.Id,
      name: data.Name?.replace(/^\//, ""),
      image: data.Config.Image,
      created: data.Created,
      path: data.Path,
      args: data.Args,
      state: data.State,
      networkSettings: {
        bridge: data.NetworkSettings.Bridge,
        ipAddress: data.NetworkSettings.IPAddress,
        gateway: data.NetworkSettings.Gateway,
        macAddress: data.NetworkSettings.MacAddress,
        networks: data.NetworkSettings.Networks,
        ports: data.NetworkSettings.Ports,
      },
      mounts: data.Mounts,
      config: {
        cmd: data.Config.Cmd,
        env: data.Config.Env,
        labels: data.Config.Labels,
        exposedPorts: data.Config.ExposedPorts,
        workingDir: data.Config.WorkingDir,
      },
      hostConfig: {
        memory: data.HostConfig.Memory,
        nanoCpus: data.HostConfig.NanoCpus,
        restartPolicy: data.HostConfig.RestartPolicy,
        networkMode: data.HostConfig.NetworkMode,
        portBindings: data.HostConfig.PortBindings,
        binds: data.HostConfig.Binds,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req, "containers:write");
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const { action } = await req.json();
    const container = docker.getContainer(params.id);

    switch (action) {
      case "start":
        await container.start();
        break;
      case "stop":
        await container.stop();
        break;
      case "restart":
        await container.restart();
        break;
      case "pause":
        await container.pause();
        break;
      case "unpause":
        await container.unpause();
        break;
      case "kill":
        await container.kill();
        break;
      case "remove":
        await container.remove({ force: true });
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Container ${action} executed successfully` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
