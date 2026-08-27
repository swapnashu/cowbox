import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { token, publicUrl } = await req.json();

    // Case 1: Fetch public repository details from GitHub API
    if (publicUrl && !token) {
      const match = publicUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return NextResponse.json({ error: "Invalid GitHub repository URL" }, { status: 400 });
      }

      const [, owner, rawRepo] = match;
      const repo = rawRepo.replace(/\.git$/, "");

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { "User-Agent": "Dekployer-PaaS" },
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Repository not found or rate limit exceeded" }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({
        type: "single",
        repo: {
          id: data.id,
          name: data.name,
          fullName: data.full_name,
          defaultBranch: data.default_branch,
          cloneUrl: data.clone_url,
          description: data.description,
          isPrivate: data.private,
        },
      });
    }

    // Case 2: Fetch authorized repositories using GitHub PAT / Token
    if (token) {
      const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "User-Agent": "Dekployer-PaaS",
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Invalid GitHub Token or authorization error" }, { status: 401 });
      }

      const repos = await res.json();
      return NextResponse.json({
        type: "list",
        repos: repos.map((r: any) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          defaultBranch: r.default_branch,
          cloneUrl: r.clone_url,
          description: r.description,
          isPrivate: r.private,
        })),
      });
    }

    return NextResponse.json({ error: "Please provide either a GitHub token or public URL" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
