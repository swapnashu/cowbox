import { NextResponse } from "next/server";
import { docker } from "@/lib/docker";
import { requireAuth } from "@/lib/auth/guard";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req, "full_access");
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const { command = "sh", args = [] } = await req.json();
    const container = docker.getContainer(params.id);

    // Build command array
    const cmdArray = typeof command === "string" ? ["sh", "-c", command] : command;

    const exec = await container.exec({
      Cmd: cmdArray,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    let output = "";
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
        // Demux docker stream header if needed, or decode utf-8
        output += chunk.toString("utf-8");
      });
      stream.on("end", () => resolve());
      stream.on("error", (err: any) => reject(err));
    });

    // Clean up Docker stream headers (first 8 bytes of packets)
    const cleanOutput = output.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

    const inspectData = await exec.inspect();

    return NextResponse.json({
      success: inspectData.ExitCode === 0,
      output: cleanOutput.trim() || "Command executed with no output.",
      exitCode: inspectData.ExitCode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute command in container" },
      { status: 500 }
    );
  }
}
