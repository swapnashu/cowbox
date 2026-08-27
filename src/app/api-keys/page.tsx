"use client";

import { useState, useEffect } from "react";
import {
  Key,
  ShieldCheck,
  Plus,
  Copy,
  Check,
  Trash2,
  Lock,
  Code2,
  Terminal,
  Clock,
  Sparkles,
  AlertTriangle,
  FileCode,
  ShieldAlert,
  Zap,
  Globe,
  Radio,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export default function ApiKeysSecurityPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [permissions, setPermissions] = useState("deploy:write");
  
  // Secret Key Revealed Modal (Shown ONLY once upon creation)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [selectedSnippetTab, setSelectedSnippetTab] = useState<"curl" | "github" | "python" | "node">("curl");

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchKeysAndLogs = async () => {
    try {
      const [keysRes, logsRes] = await Promise.all([
        fetch("/api/api-keys"),
        fetch("/api/audit-logs"),
      ]);
      if (keysRes.ok) {
        const kd = await keysRes.json();
        setKeys(kd.keys || []);
      }
      if (logsRes.ok) {
        const ld = await logsRes.json();
        setAuditLogs(ld.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeysAndLogs();
    const interval = setInterval(fetchKeysAndLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    setIsGenerating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim(), permissions }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsCreateModalOpen(false);
        setKeyName("");
        setNewlyCreatedKey(data.apiKey.rawKey);
        setIsSecretModalOpen(true);
        fetchKeysAndLogs();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = async (id: string, name: string) => {
    if (!confirm(`Revoke API key "${name}"? Any external services using this token will be immediately rejected.`)) return;
    try {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      fetchKeysAndLogs();
    } catch (e) {}
  };

  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(identifier);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const activeToken = newlyCreatedKey || "cbx_live_••••••••••••••••••••••••";

  const getCodeSnippet = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:9999";
    switch (selectedSnippetTab) {
      case "curl":
        return `# 1-Command Deploy via cURL
curl -X POST "${origin}/api/v1/deploy" \\
  -H "Authorization: Bearer ${activeToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "appName": "production-api",
    "dockerImage": "nginx:alpine",
    "containerPort": 80,
    "envVars": "NODE_ENV=production\\nPORT=80"
  }'`;

      case "github":
        return `# .github/workflows/deploy.yml
name: Deploy to Cowbox
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cowbox Deployment
        run: |
          curl -X POST "${origin}/api/v1/deploy" \\
            -H "Authorization: Bearer \${{ secrets.COWBOX_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "appName": "my-production-app",
              "gitRepository": "\${{ github.server_url }}/\${{ github.repository }}",
              "gitBranch": "main"
            }'`;

      case "python":
        return `# Python Deployment Script
import requests

url = "${origin}/api/v1/deploy"
headers = {
    "Authorization": "Bearer ${activeToken}",
    "Content-Type": "application/json"
}
payload = {
    "appName": "my-python-app",
    "dockerImage": "python:3.11-slim",
    "containerPort": 8000
}

response = requests.post(url, json=payload, headers=headers)
print("Deploy status:", response.status_code)
print("Response:", response.json())`;

      case "node":
        return `// Node.js / Next.js Deploy Function
async function deployApp() {
  const res = await fetch("${origin}/api/v1/deploy", {
    method: "POST",
    headers: {
      "Authorization": "Bearer ${activeToken}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appName: "nextjs-app",
      dockerImage: "node:20-alpine",
      containerPort: 3000,
    }),
  });

  const data = await res.json();
  console.log("Deployment Result:", data);
}

deployApp();`;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Key className="h-6 w-6 text-pink-600" />
            API Keys & Bulletproof Security Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create cryptographically secure SHA-256 API tokens to deploy applications and manage services programmatically via CI/CD.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-md shadow-pink-500/20"
        >
          <Plus className="h-4 w-4" />
          Generate API Key
        </Button>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-pink-200 bg-gradient-to-tr from-pink-50/40 via-white to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Active API Tokens</span>
              <Key className="h-4 w-4 text-pink-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{keys.length}</div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">SHA-256 Authenticated</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-tr from-emerald-50/40 via-white to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Security Guard</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">Bulletproof</div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Timing-Attack Immune</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Audit Records</span>
              <Radio className="h-4 w-4 text-slate-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{auditLogs.length}</div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Real-time event logging</p>
          </CardContent>
        </Card>
      </div>

      {/* Active API Keys Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-pink-600" />
              Active API Access Keys ({keys.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading API keys...</div>
          ) : keys.length === 0 ? (
            <div className="p-12 text-center">
              <Key className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No API keys generated yet</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Generate an API key to enable CI/CD deployment from GitHub Actions or curl.
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)} size="sm" variant="success" className="font-bold">
                <Plus className="h-4 w-4 mr-1" />
                Generate First API Key
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {keys.map((k) => (
                <div key={k.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{k.name}</span>
                      <Badge variant="pink" className="text-[10px] uppercase font-bold">
                        {k.permissions}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                      <span>Prefix: <strong className="text-slate-700">{k.keyPrefix}</strong></span>
                      <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                      <span>Last Used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleRevokeKey(k.id, k.name)}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 self-end sm:self-center font-semibold"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Revoke Key
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive Deploy by API Code Snippets */}
      <Card className="shadow-sm border-pink-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Code2 className="h-5 w-5 text-pink-600" />
                Deploy by API — Ready-to-Use SDK & cURL Snippets
              </CardTitle>
              <CardDescription>
                Trigger automated deployments from GitHub Actions, GitLab CI, curl, or your own backend.
              </CardDescription>
            </div>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {(["curl", "github", "python", "node"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedSnippetTab(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg uppercase transition-all ${
                    selectedSnippetTab === tab
                      ? "bg-white text-pink-600 shadow-sm border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-950">
          <div className="relative">
            <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed overflow-x-auto terminal-scroll p-2">
              {getCodeSnippet()}
            </pre>
            <button
              onClick={() => copyToClipboard(getCodeSnippet(), "code")}
              className="absolute top-0 right-0 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-mono text-xs flex items-center gap-1.5"
            >
              {copiedSnippet === "code" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSnippet === "code" ? "Copied!" : "Copy Code"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Live Security Audit Log Stream */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-emerald-600" />
            Security & Access Audit Logs ({auditLogs.length})
          </CardTitle>
          <CardDescription>Immutable record of all API deployments and authentication events</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No audit records yet</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto terminal-scroll font-mono text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={log.status === "success" ? "success" : log.status === "unauthorized" ? "destructive" : "warning"}
                      className="text-[10px] uppercase font-bold"
                    >
                      {log.status}
                    </Badge>
                    <div>
                      <span className="font-bold text-slate-800 block">{log.action}</span>
                      <span className="text-[11px] text-slate-500">{log.details}</span>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-400">
                    <div>{log.ipAddress || "127.0.0.1"}</div>
                    <div>{new Date(log.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate New API Key"
        description="Creates a cryptographically secure token for automated CI/CD deployments"
      >
        <form onSubmit={handleCreateKey} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Token Name *</label>
            <Input
              placeholder="e.g. GitHub Actions CI, Production Pipeline"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Permissions Scope</label>
            <select
              value={permissions}
              onChange={(e) => setPermissions(e.target.value)}
              className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500"
            >
              <option value="deploy:write">deploy:write (Can trigger deployments)</option>
              <option value="apps:read,deploy:write">apps:read + deploy:write (Deploy & check telemetry)</option>
              <option value="full_access">full_access (Complete administrative access)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isGenerating} variant="success" className="font-bold">
              Generate Key
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reveal Secret Token Modal (Shown ONLY ONCE) */}
      <Modal
        isOpen={isSecretModalOpen}
        onClose={() => setIsSecretModalOpen(false)}
        title="🎉 API Key Created Successfully!"
        description="Please copy your secret token now. You will NOT be able to see it again."
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-semibold flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Store this token securely in your GitHub Secrets or environment variables.</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Secret Token</label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={newlyCreatedKey || ""}
                className="font-mono text-xs bg-slate-50 text-slate-900 font-bold"
              />
              <Button
                onClick={() => {
                  if (newlyCreatedKey) {
                    navigator.clipboard.writeText(newlyCreatedKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }
                }}
                variant="success"
                className="font-bold whitespace-nowrap"
              >
                {copiedKey ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copiedKey ? "Copied!" : "Copy Token"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button onClick={() => setIsSecretModalOpen(false)} variant="outline" className="font-bold">
              Done & Saved
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
