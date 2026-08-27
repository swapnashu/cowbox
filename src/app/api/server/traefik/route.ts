import { NextResponse } from "next/server";
import { docker, ensureCowboxNetwork, COWBOX_NETWORK } from "@/lib/docker";

export async function POST(req: Request) {
  try {
    const { letsEncryptEmail } = await req.json().catch(() => ({ letsEncryptEmail: "" }));
    await ensureCowboxNetwork();

    // Check if Traefik container already exists
    const containers = await docker.listContainers({ all: true });
    const existingTraefik = containers.find((c) =>
      c.Names.some((n) => n.includes("cowbox-traefik") || n.includes("dekployer-traefik"))
    );

    if (existingTraefik) {
      const containerObj = docker.getContainer(existingTraefik.Id);
      if (existingTraefik.State === "running") {
        await containerObj.restart();
        return NextResponse.json({ success: true, message: "Traefik proxy restarted successfully" });
      } else {
        await containerObj.start();
        return NextResponse.json({ success: true, message: "Traefik proxy started successfully" });
      }
    }

    try {
      await docker.pull("traefik:v3.1");
    } catch (e) {}

    const traefikArgs = [
      "--api.dashboard=true",
      "--api.insecure=true",
      "--providers.docker=true",
      "--providers.docker.exposedbydefault=false",
      `--providers.docker.network=${COWBOX_NETWORK}`,
      "--entrypoints.web.address=:80",
      "--entrypoints.websecure.address=:443",
    ];

    if (letsEncryptEmail) {
      traefikArgs.push(
        `--certificatesresolvers.letsencrypt.acme.email=${letsEncryptEmail}`,
        "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json",
        "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      );
    }

    const container = await docker.createContainer({
      Image: "traefik:v3.1",
      name: "cowbox-traefik",
      Cmd: traefikArgs,
      HostConfig: {
        NetworkMode: COWBOX_NETWORK,
        PortBindings: {
          "80/tcp": [{ HostPort: "80" }],
          "443/tcp": [{ HostPort: "443" }],
          "8080/tcp": [{ HostPort: "8080" }],
        },
        Binds: [
          process.platform === "win32"
            ? "//./pipe/docker_engine://./pipe/docker_engine"
            : "/var/run/docker.sock:/var/run/docker.sock:ro",
          "cowbox-traefik-certs:/letsencrypt",
        ],
        RestartPolicy: { Name: "always" },
      },
    });

    await container.start();

    return NextResponse.json({
      success: true,
      message: "Traefik reverse proxy provisioned and running on ports 80, 443, 8080",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to initialize Traefik" },
      { status: 500 }
    );
  }
}
