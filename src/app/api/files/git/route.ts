import { NextResponse } from "next/server";
import { WORKSPACE_ROOT, resolveAccessPath, AccessDeniedError } from "@/lib/workspace";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

const execFileAsync = promisify(execFile);

/** Git status paths are repo-relative; make them absolute relative to the repo dir. */
function pathToAbs(p: string, repoDir: string): string {
  if (!p) return p;
  const cleaned = p.replace(/\0/g, "");
  if (/^[a-zA-Z]:[\\/]/.test(cleaned) || cleaned.startsWith("/") || cleaned.startsWith("\\")) {
    return cleaned;
  }
  return path.join(repoDir, cleaned);
}

async function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: any) {
    return { stdout: err.stdout?.trim() || "", stderr: err.stderr?.trim() || err.message };
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, "files:read");
    if (!auth.authenticated) return auth.response!;

    const { searchParams } = new URL(req.url);
    const repoPath = searchParams.get("repo") || "";
    const rootMode = (searchParams.get("root") === "1" || searchParams.get("root") === "true") && auth.user?.role === "admin";
    const targetDir = repoPath ? resolveAccessPath(repoPath, { isAdmin: auth.user?.role === "admin", allowRoot: rootMode }) : WORKSPACE_ROOT;

    const { stdout: branchOut } = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], targetDir);
    if (branchOut.includes("fatal: not a git repository")) {
      return NextResponse.json({ isRepo: false, branch: "", files: [], ahead: 0, behind: 0 });
    }

    const { stdout: statusOut } = await runGit(["status", "--porcelain=v1"], targetDir);
    const { stdout: branchFull } = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], targetDir);
    const { stdout: aheadOut } = await runGit(["rev-list", "--count", `${branchFull}..HEAD`], targetDir);
    const { stdout: behindOut } = await runGit(["rev-list", "--count", `HEAD..${branchFull}`], targetDir);

    const files = statusOut
      ? statusOut.split("\n").filter(Boolean).map((line) => {
          const statusChar = line[0];
          const filePath = line.substring(3);
          const statusMap: Record<string, string> = {
            M: "modified",
            A: "added",
            D: "deleted",
            R: "renamed",
            "?": "untracked",
            C: "copied",
          };
          return {
            path: filePath,
            status: statusMap[statusChar] || "unknown",
            staged: statusChar === statusChar.toUpperCase() && statusChar !== "?" && statusChar !== " ",
          };
        })
      : [];

    return NextResponse.json({
      isRepo: true,
      branch: branchOut,
      files,
      ahead: parseInt(aheadOut) || 0,
      behind: parseInt(behindOut) || 0,
    });
  } catch (error: any) {
    console.error("[Files/Git] GET error:", error.message);
    return NextResponse.json({ isRepo: false, branch: "", files: [], ahead: 0, behind: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, "full_access");
    if (!auth.authenticated) return auth.response!;

    const body = await req.json();
    const { action, dir, message, filePath, root } = body;
    const rootMode = !!root && auth.user?.role === "admin";
    const targetDir = dir ? resolveAccessPath(dir, { isAdmin: auth.user?.role === "admin", allowRoot: rootMode }) : WORKSPACE_ROOT;

    if (action === "commit") {
      if (!message || message.trim().length === 0) {
        return NextResponse.json({ error: "Commit message is required" }, { status: 400 });
      }
      await runGit(["add", "-A"], targetDir);
      const { stdout, stderr } = await runGit(["commit", "-m", message.trim()], targetDir);
      return NextResponse.json({ success: true, message: stdout || stderr });
    }

    if (action === "stage" && filePath) {
      const resolved = resolveAccessPath(pathToAbs(filePath, targetDir), { isAdmin: auth.user?.role === "admin", allowRoot: rootMode });
      const { stdout, stderr } = await runGit(["add", resolved], targetDir);
      return NextResponse.json({ success: true, message: stdout || stderr });
    }

    if (action === "unstage" && filePath) {
      const resolved = resolveAccessPath(pathToAbs(filePath, targetDir), { isAdmin: auth.user?.role === "admin", allowRoot: rootMode });
      const { stdout, stderr } = await runGit(["reset", "HEAD", "--", resolved], targetDir);
      return NextResponse.json({ success: true, message: stdout || stderr });
    }

    if (action === "init") {
      const { stdout, stderr } = await runGit(["init"], targetDir);
      return NextResponse.json({ success: true, message: stdout || stderr });
    }

    if (action === "log") {
      const { stdout } = await runGit(["log", "--oneline", "-20"], targetDir);
      const entries = stdout.split("\n").filter(Boolean).map((line) => {
        const [hash, ...rest] = line.split(" ");
        return { hash, message: rest.join(" ") };
      });
      return NextResponse.json({ entries });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files/Git] POST error:", error.message);
    return NextResponse.json({ error: "Git operation failed" }, { status: 500 });
  }
}
