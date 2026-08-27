import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";

const docker = new Docker({ socketPath: "//./pipe/docker_engine" }); // default windows socket, or can just use new Docker() which works mostly. We will use generic initialization.

export async function GET() {
  try {
    const dockerInstance = new Docker();
    const networks = await dockerInstance.listNetworks();
    
    const formattedNetworks = networks.map(net => {
      const containers = Object.entries(net.Containers || {}).map(([id, info]: [string, any]) => ({
        id,
        name: info.Name,
        ipAddress: info.IPv4Address
      }));

      return {
        id: net.Id,
        name: net.Name,
        driver: net.Driver,
        scope: net.Scope,
        containers
      };
    });

    return NextResponse.json(formattedNetworks);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, driver = 'bridge' } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const dockerInstance = new Docker();
    const network = await dockerInstance.createNetwork({
      Name: name,
      Driver: driver
    });

    return NextResponse.json({ id: network.id, name, driver });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const dockerInstance = new Docker();
    const network = dockerInstance.getNetwork(id);
    await network.remove();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
