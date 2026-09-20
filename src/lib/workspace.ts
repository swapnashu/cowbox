import * as fs from "fs";
import * as path from "path";

export const WORKSPACE_ROOT = process.cwd();

/** Thrown when a requested path escapes the workspace sandbox or root-mode is misused. Maps to HTTP 403. */
export class AccessDeniedError extends Error {
  constructor(message = "Access denied: Path is outside the allowed workspace") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function ensureWorkspaceDir(): string {
  if (!fs.existsSync(WORKSPACE_ROOT)) {
    fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  }

  const jsPath = path.join(WORKSPACE_ROOT, "cowbox_example.js");
  const pyPath = path.join(WORKSPACE_ROOT, "cowbox_example.py");
  const shPath = path.join(WORKSPACE_ROOT, "cowbox_example.sh");

  if (!fs.existsSync(jsPath)) {
    const sampleJs = `// JavaScript / Node.js Runner Example
console.log("Welcome to Cowbox Code Runner!");
console.log("Current Time:", new Date().toISOString());

const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Transformed Array:", doubled);
`;
    fs.writeFileSync(jsPath, sampleJs);
  }

  if (!fs.existsSync(pyPath)) {
    const samplePy = `# Python Runner Example
import sys
import datetime

print(f"Cowbox Python Environment: Python {sys.version.split()[0]}")
print(f"Execution Date: {datetime.datetime.now()}")

for i in range(1, 6):
    print(f"Step {i}: Processing job...")
print("Execution Complete!")
`;
    fs.writeFileSync(pyPath, samplePy);
  }

  if (!fs.existsSync(shPath)) {
    const sampleSh = `#!/usr/bin/env bash
# Shell Script Runner Example
echo "Running Shell Script in Cowbox Workspace"
echo "Host Operating System: $(uname -s 2>/dev/null || echo Windows)"
echo "Listing directory files:"
ls -la 2>/dev/null || dir
`;
    fs.writeFileSync(shPath, sampleSh);
  }
  return WORKSPACE_ROOT;
}

/**
 * Resolve a path for file manager operations.
 * - Workspace mode (default): relative to WORKSPACE_ROOT, traversal + symlink guarded.
 * - Root mode (admin only): absolute paths anywhere on the host filesystem.
 */
export function resolveSafePath(relativePath: string): string {
  const root = path.resolve(ensureWorkspaceDir());

  const sanitized = relativePath
    .replace(/\0/g, "")
    .replace(/%2e%2e/gi, "")
    .replace(/%2f/gi, "/")
    .replace(/%5c/gi, "\\");

  const safeRelative = sanitized ? sanitized.replace(/^(\.\.[\/\\])+/, "") : "";
  const resolved = path.resolve(root, safeRelative);
  const normalizedRoot = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(normalizedRoot)) {
    throw new AccessDeniedError();
  }

  // Defend against symlinks/junctions that point outside the workspace: verify the
  // real (physical) path stays inside the real workspace root.
  const realRoot = fs.realpathSync.native ? fs.realpathSync.native(root) : fs.realpathSync(root);
  let realResolved = resolved;
  try {
    realResolved = fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
  } catch {
    // The target may not exist yet (e.g. creating a new file). Fall back to the
    // deepest existing ancestor so a junction on the parent is still caught.
    let probe = resolved;
    while (probe !== path.dirname(probe)) {
      probe = path.dirname(probe);
      try {
        realResolved = fs.realpathSync.native ? fs.realpathSync.native(probe) : fs.realpathSync(probe);
        break;
      } catch {
        // keep walking up
      }
    }
  }

  const normalizedRealRoot = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (realResolved !== realRoot && !realResolved.startsWith(normalizedRealRoot)) {
    throw new AccessDeniedError("Access denied: Symlink or junction escapes the workspace");
  }

  return resolved;
}

/** Feature flag: admins may browse/edit the whole filesystem. Set COWBOX_ROOT_FS=0 to disable. */
export const ROOT_FS_ENABLED = () => (process.env.COWBOX_ROOT_FS ?? "1") !== "0";

/** True when the incoming param looks like an absolute filesystem path (drive letter or rooted slash). */
export function isAbsoluteFsPath(p: string): boolean {
  const s = (p || "").replace(/\0/g, "").trim();
  if (!s) return false;
  const drive = /^[a-zA-Z]:[\\/]/.test(s);
  return drive || s.startsWith("/") || s.startsWith("\\") || path.isAbsolute(s);
}

/**
 * Resolve a path for file manager operations.
 * - Workspace mode (default): relative to WORKSPACE_ROOT, traversal-guarded.
 * - Root mode (admin only): absolute paths anywhere on the host filesystem.
 */
export function resolveAccessPath(
  input: string,
  opts: { isAdmin?: boolean; allowRoot?: boolean } = {}
): string {
  const sanitized = (input || "")
    .replace(/\0/g, "")
    .replace(/%2e%2e/gi, "")
    .replace(/%2f/gi, "/")
    .replace(/%5c/gi, "\\");

  const useRoot = !!opts.allowRoot && !!opts.isAdmin && ROOT_FS_ENABLED() && isAbsoluteFsPath(sanitized);
  if (useRoot) {
    return path.resolve(sanitized);
  }
  return resolveSafePath(sanitized);
}

/** Convert a file mode to an rwx string like `rwxr-xr-x`. */
export function formatMode(mode: number): string {
  const bits = [
    { m: 0o400, c: "r" }, { m: 0o200, c: "w" }, { m: 0o100, c: "x" },
    { m: 0o040, c: "r" }, { m: 0o020, c: "w" }, { m: 0o010, c: "x" },
    { m: 0o004, c: "r" }, { m: 0o002, c: "w" }, { m: 0o001, c: "x" },
  ];
  return bits.map((b) => (mode & b.m ? b.c : "-")).join("");
}

/** Octal permission string like `755` from a mode. */
export function modeString(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, "0");
}

/**
 * Guards against catastrophic deletes/renames: the workspace root itself,
 * drive roots, and the OS root. Everything else is fair game for admins.
 */
export function isProtectedSystemPath(resolved: string): boolean {
  const p = path.resolve(resolved);
  const root = path.parse(p).root;
  if (p === root) return true; // e.g. C:\ or /
  if (p === path.resolve(WORKSPACE_ROOT)) return true;
  return false;
}
