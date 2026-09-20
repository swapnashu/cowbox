import { NextResponse } from "next/server";
import { resolveAccessPath, WORKSPACE_ROOT, AccessDeniedError } from "@/lib/workspace";
import * as fs from "fs/promises";
import * as path from "path";
import { requireAuth } from "@/lib/auth/guard";

const SEARCHABLE_EXTENSIONS = new Set([
  "js", "mjs", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java",
  "sh", "bash", "json", "yaml", "yml", "toml", "xml", "html", "css",
  "scss", "md", "sql", "php", "c", "cpp", "h", "hpp", "txt", "env",
  "dockerfile", "makefile", "lock", "csv", "log",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  ".cache", "coverage", ".vercel", ".netlify",
  "Windows", "System32", "SysWOW64", "$Recycle.Bin", "System Volume Information",
  "Program Files", "Program Files (x86)", "ProgramData", "Recovery",
  ".gradle", ".m2", ".npm", ".yarn", "Pods", "vendor",
]);

interface SearchResult {
  file: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

async function searchInFile(filePath: string, query: string, rootMode: boolean): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > 1024 * 1024) return results;

    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const lowerQuery = query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      const idx = lowerLine.indexOf(lowerQuery);
      if (idx !== -1) {
        results.push({
          file: rootMode ? filePath.replace(/\\/g, "/") : path.relative(WORKSPACE_ROOT, filePath).replace(/\\/g, "/"),
          line: i + 1,
          content: lines[i].trim().substring(0, 200),
          matchStart: idx,
          matchEnd: idx + query.length,
        });
        if (results.length >= 50) break;
      }
    }
  } catch {
    // skip unreadable files
  }
  return results;
}

async function walkSearch(dirPath: string, query: string, maxResults: number, rootMode: boolean): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (allResults.length >= maxResults) break;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          const subResults = await walkSearch(fullPath, query, maxResults - allResults.length, rootMode);
          allResults.push(...subResults);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase().replace(/^\./, "");
        if (SEARCHABLE_EXTENSIONS.has(ext)) {
          const fileResults = await searchInFile(fullPath, query, rootMode);
          allResults.push(...fileResults);
        }
      }
    }
  } catch {
    // skip inaccessible dirs
  }
  return allResults;
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, "files:read");
    if (!auth.authenticated) return auth.response!;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const dirParam = searchParams.get("dir") || "";
    const rootMode = (searchParams.get("root") === "1" || searchParams.get("root") === "true") && auth.user?.role === "admin";

    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const targetDir = dirParam ? resolveAccessPath(dirParam, { isAdmin: auth.user?.role === "admin", allowRoot: rootMode }) : WORKSPACE_ROOT;
    const results = await walkSearch(targetDir, query.trim(), 100, rootMode);

    return NextResponse.json({ results, total: results.length });
  } catch (error: any) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Files/Search] GET error:", error.message);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
