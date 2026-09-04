import { NextRequest, NextResponse } from "next/server";
import { docker } from "@/lib/docker";

export async function GET() {
  try {
    const networks = await docker.listNetworks();
    
    const formattedNetworks = networks.map((net) => {
      const containers = Object.entries(net.Containers || {}).map(([id, info]: [string, any]) => ({
        id: id.substring(0, 12),
        name: info.Name,
        ipv4: info.IPv4Address,
        ipAddress: info.IPv4Address,
      }));

      return {
        id: net.Id,
        name: net.Name,
        driver: net.Driver,
        scope: net.Scope,
        containers,
      };
    });

    return NextResponse.json({ networks: formattedNetworks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch networks", networks: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, driver = "bridge" } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const network = await docker.createNetwork({
      Name: name,
      Driver: driver,
    });

    return NextResponse.json({ id: network.id, name, driver });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create network" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const network = docker.getNetwork(id);
    await network.remove();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete network" }, { status: 500 });
  }
}
