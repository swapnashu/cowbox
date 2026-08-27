import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { docker } from "@/lib/docker";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();
    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, params.id));

    if (!app) {
      return new Response("Application not found", { status: 404 });
    }

    if (!app.containerId) {
      return new Response("No active container", { status: 404 });
    }

    const container = docker.getContainer(app.containerId);
    
    // Follow the logs stream
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
      follow: true,
      timestamps: true,
    });

    // Create a ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        logStream.on("data", (chunk: Buffer) => {
          // Chunk includes docker multiplexing header (8 bytes)
          let text = chunk.toString("utf-8");
          
          // Split by newline and send each
          const lines = text.split("\n");
          for (const line of lines) {
            // Remove docker 8-byte stream header headers if present
            const cleanLine = line.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
            if (cleanLine.trim()) {
              controller.enqueue(`data: ${cleanLine}\n\n`);
            }
          }
        });

        logStream.on("end", () => {
          controller.close();
        });

        logStream.on("error", (err: any) => {
          controller.error(err);
        });

        // Handle client disconnect
        req.signal.addEventListener("abort", () => {
          (logStream as any).destroy();
        });
      },
      cancel() {
        (logStream as any).destroy();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
