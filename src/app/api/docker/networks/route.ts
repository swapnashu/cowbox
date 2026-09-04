import { NextResponse } from "next/server";
import { docker, checkDockerConnection } from "@/lib/docker";

export async function GET() {
  try {
    const status = await checkDockerConnection();
    if (!status.connected) {
      return NextResponse.json({ networks: [] });
    }

    const rawNetworks = await docker.listNetworks();

    const networks = rawNetworks.map((n: any) => {
      const ipamConfig = n.IPAM?.Config?.[0] || {};
      const containers = Object.entries(n.Containers || {}).map(([id, info]: [string, any]) => ({
        id: id.substring(0, 12),
        name: info.Name,
        ipv4Address: info.IPv4Address,
        macAddress: info.MacAddress,
      }));

      return {
        id: n.Id,
        shortId: n.Id.substring(0, 12),
        name: n.Name,
        driver: n.Driver,
        scope: n.Scope,
        internal: n.Internal,
        enableIPv6: n.EnableIPv6,
        subnet: ipamConfig.Subnet || "N/A",
        gateway: ipamConfig.Gateway || "N/A",
        containers,
        containersCount: containers.length,
        isManaged: n.Labels?.["cowbox.managed"] === "true",
      };
    });

    return NextResponse.json({ networks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, networks: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, driver = "bridge" } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Network name is required" }, { status: 400 });
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");

    const network = await docker.createNetwork({
      Name: cleanName,
      Driver: driver,
      CheckDuplicate: true,
      Labels: {
        "cowbox.managed": "true",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Network "${cleanName}" created successfully`,
      network: { id: network.id, name: cleanName, driver },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const networkId = searchParams.get("id") || searchParams.get("name");

    if (!networkId) {
      return NextResponse.json({ error: "Network ID or Name is required" }, { status: 400 });
    }

    const netObj = docker.getNetwork(networkId);
    await netObj.remove();

    return NextResponse.json({
      success: true,
      message: `Network "${networkId}" removed successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
