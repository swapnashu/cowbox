import * as fs from "fs";
import * as path from "path";

export const WORKSPACE_ROOT = path.join(process.cwd(), "data", "workspace");

// Ensure workspace directory exists and has starter files
export function ensureWorkspaceDir(): string {
  if (!fs.existsSync(WORKSPACE_ROOT)) {
    fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });

    // Seed starter example files
    const sampleJs = `// JavaScript / Node.js Runner Example
console.log("🐮 Welcome to Cowbox Code Runner!");
console.log("Current Time:", new Date().toISOString());

const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Transformed Array:", doubled);
`;

    const samplePy = `# Python Runner Example
import sys
import datetime

print(f"🐮 Cowbox Python Environment: Python {sys.version.split()[0]}")
print(f"Execution Date: {datetime.datetime.now()}")

for i in range(1, 6):
    print(f"Step {i}: Processing job...")
print("Execution Complete!")
`;

    const sampleSh = `#!/usr/bin/env bash
# Shell Script Runner Example
echo "🐮 Running Shell Script in Cowbox Workspace"
echo "Host Operating System: $(uname -s 2>/dev/null || echo Windows)"
echo "Listing directory files:"
ls -la 2>/dev/null || dir
`;

    fs.writeFileSync(path.join(WORKSPACE_ROOT, "index.js"), sampleJs);
    fs.writeFileSync(path.join(WORKSPACE_ROOT, "script.py"), samplePy);
    fs.writeFileSync(path.join(WORKSPACE_ROOT, "run.sh"), sampleSh);
  }
  return WORKSPACE_ROOT;
}

// Prevent path traversal
export function resolveSafePath(relativePath: string): string {
  const root = ensureWorkspaceDir();
  const safeRelative = relativePath ? relativePath.replace(/^(\.\.[\/\\])+/, "") : "";
  const resolved = path.resolve(root, safeRelative);
  if (!resolved.startsWith(root)) {
    throw new Error("Access denied: Path is outside workspace");
  }
  return resolved;
}
