import { NextResponse } from "next/server";
import { resolveSafePath, WORKSPACE_ROOT } from "@/lib/workspace";
import { exec } from "child_process";
import * as path from "path";

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const { filePath, command } = await req.json();

    let cmdToRun = "";

    if (command && command.trim() !== "") {
      cmdToRun = command.trim();
    } else if (filePath) {
      const fullPath = resolveSafePath(filePath);
      const ext = path.extname(fullPath).toLowerCase();
      const filename = path.basename(fullPath);

      switch (ext) {
        case ".js":
        case ".mjs":
          cmdToRun = `node "${filename}"`;
          break;
        case ".ts":
          cmdToRun = `npx tsx "${filename}"`;
          break;
        case ".py":
          cmdToRun = `python "${filename}"`;
          break;
        case ".sh":
        case ".bash":
          cmdToRun = process.platform === "win32" ? `bash "${filename}"` : `sh "${filename}"`;
          break;
        case ".go":
          cmdToRun = `go run "${filename}"`;
          break;
        case ".php":
          cmdToRun = `php "${filename}"`;
          break;
        case ".rb":
          cmdToRun = `ruby "${filename}"`;
          break;
        case ".json":
          cmdToRun = `node -e "console.log(JSON.stringify(require('./${filename}'), null, 2))"`;
          break;
        default:
          cmdToRun = process.platform === "win32" ? `type "${filename}"` : `cat "${filename}"`;
          break;
      }
    } else {
      return NextResponse.json({ error: "Please provide either a filePath or command to execute" }, { status: 400 });
    }

    // Execute in WORKSPACE_ROOT with a 20-second timeout safety limit
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      exec(
        cmdToRun,
        {
          cwd: WORKSPACE_ROOT,
          timeout: 20000,
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer
          env: {
            ...process.env,
            PYTHONIOENCODING: "utf-8",
            PYTHONUTF8: "1",
            NODE_ENV: "development",
          },
        },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout || "",
            stderr: stderr || (error && error.message ? error.message : ""),
            exitCode: error ? (error.code ?? 1) : 0,
          });
        }
      );
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: result.exitCode === 0,
      command: cmdToRun,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stdout: "",
        stderr: error.message,
        exitCode: 1,
        durationMs,
      },
      { status: 500 }
    );
  }
}
