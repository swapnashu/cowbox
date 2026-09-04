import { COWBOX_VERSION } from "@/lib/version";

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  pypi: {
    version: string;
    url: string;
    publishedAt?: string;
  };
  github: {
    version: string;
    url: string;
    notes?: string;
    publishedAt?: string;
  };
  instructions: {
    pip: string;
    docker: string;
    git: string;
  };
  lastChecked: string;
}

let cachedUpdateInfo: UpdateInfo | null = null;
let lastCheckTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function parseSemver(v: string): number[] {
  const cleaned = v.replace(/^[vV]/, "").trim();
  const parts = cleaned.split(".").map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

export function compareSemver(v1: string, v2: string): number {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

export async function checkForUpdates(force = false): Promise<UpdateInfo> {
  const now = Date.now();
  if (!force && cachedUpdateInfo && now - lastCheckTimestamp < CACHE_TTL_MS) {
    return cachedUpdateInfo;
  }

  const currentVersion = COWBOX_VERSION;
  let pypiVersion = currentVersion;
  let pypiUrl = "https://pypi.org/project/cowbox/";
  let pypiPublishedAt = "";

  let githubVersion = currentVersion;
  let githubUrl = "https://github.com/swapnashu/cowbox";
  let githubNotes = "";
  let githubPublishedAt = "";

  // 1. Fetch PyPI Info
  try {
    const pypiRes = await fetch("https://pypi.org/pypi/cowbox/json", {
      headers: { "User-Agent": "Cowbox-Update-Checker/1.0" },
      next: { revalidate: 300 },
    });
    if (pypiRes.ok) {
      const data = await pypiRes.json();
      if (data.info?.version) {
        pypiVersion = data.info.version;
        pypiUrl = `https://pypi.org/project/cowbox/${pypiVersion}/`;
      }
      if (data.urls && data.urls.length > 0 && data.urls[0].upload_time_iso_8601) {
        pypiPublishedAt = data.urls[0].upload_time_iso_8601;
      }
    }
  } catch (err) {
    console.error("Failed to check PyPI for updates:", err);
  }

  // 2. Fetch GitHub Releases / Tags
  try {
    const ghRes = await fetch("https://api.github.com/repos/swapnashu/cowbox/releases/latest", {
      headers: { "User-Agent": "Cowbox-Update-Checker/1.0" },
      next: { revalidate: 300 },
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      if (ghData.tag_name) {
        githubVersion = ghData.tag_name.replace(/^[vV]/, "");
        githubUrl = ghData.html_url || `https://github.com/swapnashu/cowbox/releases/tag/${ghData.tag_name}`;
        githubNotes = ghData.body || "";
        githubPublishedAt = ghData.published_at || "";
      }
    } else {
      // Fallback to tags if no formal release
      const tagsRes = await fetch("https://api.github.com/repos/swapnashu/cowbox/tags", {
        headers: { "User-Agent": "Cowbox-Update-Checker/1.0" },
        next: { revalidate: 300 },
      });
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        if (Array.isArray(tags) && tags.length > 0) {
          githubVersion = tags[0].name.replace(/^[vV]/, "");
          githubUrl = `https://github.com/swapnashu/cowbox/releases/tag/${tags[0].name}`;
        }
      }
    }
  } catch (err) {
    console.error("Failed to check GitHub for updates:", err);
  }

  // Determine highest latest version between PyPI and GitHub
  let latestVersion = currentVersion;
  if (compareSemver(pypiVersion, latestVersion) > 0) {
    latestVersion = pypiVersion;
  }
  if (compareSemver(githubVersion, latestVersion) > 0) {
    latestVersion = githubVersion;
  }

  const hasUpdate = compareSemver(currentVersion, latestVersion) < 0;

  cachedUpdateInfo = {
    hasUpdate,
    currentVersion,
    latestVersion,
    pypi: {
      version: pypiVersion,
      url: pypiUrl,
      publishedAt: pypiPublishedAt || undefined,
    },
    github: {
      version: githubVersion,
      url: githubUrl,
      notes: githubNotes || undefined,
      publishedAt: githubPublishedAt || undefined,
    },
    instructions: {
      pip: "pip install --upgrade cowbox && cowbox restart",
      docker: "docker pull cowbox:latest && docker restart cowbox-server",
      git: "git pull origin main && npm install && npm run build",
    },
    lastChecked: new Date().toISOString(),
  };

  lastCheckTimestamp = now;
  return cachedUpdateInfo;
}
