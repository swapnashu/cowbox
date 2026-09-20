import { NextResponse } from "next/server";
import { resolveAccessPath, WORKSPACE_ROOT, AccessDeniedError } from "@/lib/workspace";
import { execFile } from "child_process";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runProcess(file: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        cwd,
        timeout: 20000,
        maxBuffer: 1024 * 1024 * 5,
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
          exitCode: error ? (typeof error.code === "number" ? error.code : 1) : 0,
        });
      }
    );
  });
}

const BAD_COMMANDS = ["rm -rf", ":(){", "mkfs", "dd if=", "> /dev/sda", "shutdown", "reboot"];

export async function POST(req: Request) {
  const auth = await requireAuth(req, "full_access");
  if (!auth.authenticated) {
    return auth.response;
  }

  const startTime = Date.now();
  try {
    const { filePath, command, root } = await req.json();
    const rootMode = !!root;
    const isAdmin = auth.user?.role === "admin";

    if (command && command.trim() !== "") {
      const cmd = command.trim();
      for (const bad of BAD_COMMANDS) {
        if (cmd.toLowerCase().includes(bad)) {
          return NextResponse.json({ error: "Command blocked for safety" }, { status: 400 });
        }
      }
      // Split on whitespace, allow quoted args
      const args: string[] = [];
      const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
      let m;
      while ((m = regex.exec(cmd)) !== null) {
        args.push(m[1] ?? m[2] ?? m[3]);
      }
      const result = await runProcess(args[0], args.slice(1), WORKSPACE_ROOT);
      return NextResponse.json({
        success: result.exitCode === 0,
        command: cmd,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Date.now() - startTime,
      });
    }

    if (filePath) {
      const fullPath = resolveAccessPath(filePath, { isAdmin, allowRoot: rootMode });
      const ext = path.extname(fullPath).toLowerCase();
      const workDir = path.dirname(fullPath);
      const fileName = path.basename(fullPath);

      const launchers: Record<string, [string, string[]]> = {
        ".js": ["node", [fileName]],
        ".mjs": ["node", [fileName]],
        ".ts": [process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", fileName]],
        ".py": ["python", [fileName]],
        ".sh": [process.platform === "win32" ? "bash" : "sh", [fileName]],
        ".bash": [process.platform === "win32" ? "bash" : "sh", [fileName]],
        ".go": ["go", ["run", fileName]],
        ".php": ["php", [fileName]],
        ".rb": ["ruby", [fileName]],
        ".json": ["node", ["-e", `console.log(JSON.stringify(require('./${fileName.replace(/\\/g, "\\\\")}'), null, 2))`]],
      };

      const launcher = launchers[ext];
      if (launcher) {
        const result = await runProcess(launcher[0], launcher[1], workDir);
        return NextResponse.json({
          success: result.exitCode === 0,
          command: `${launcher[0]} ${launcher[1].join(" ")}`,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          durationMs: Date.now() - startTime,
        });
      }

      // Default: print file contents
      const result = await runProcess(
        process.platform === "win32" ? "type" : "cat",
        [fileName],
        workDir
      );
      return NextResponse.json({
        success: result.exitCode === 0,
        command: `${process.platform === "win32" ? "type" : "cat"} ${fileName}`,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Date.now() - startTime,
      });
    }

    return NextResponse.json({ error: "Please provide either a filePath or command to execute" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          stdout: "",
          stderr: error.message,
          exitCode: 1,
          durationMs: Date.now() - startTime,
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stdout: "",
        stderr: error.message,
        exitCode: 1,
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}