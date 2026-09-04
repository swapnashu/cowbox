"use client";

import { useEffect, useState } from "react";
import {
  Cpu,
  Server,
  Activity,
  MemoryStick,
  Play,
  RotateCw,
  Square,
  Search,
  HardDrive,
  ArrowUpCircle,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function MasterPanelPage() {
  const [status, setStatus] = useState<any>(null);
  const [containers, setContainers] = useState<any[]>([]);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    try {
      const [statusRes, containersRes, updatesRes] = await Promise.all([
        fetch("/api/server/status"),
        fetch("/api/containers"),
        fetch("/api/system/updates"),
      ]);
      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
      if (containersRes.ok) {
        const cData = await containersRes.json();
        setContainers(cData.containers || []);
      }
      if (updatesRes.ok) {
        setUpdateInfo(await updatesRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCheck = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await fetch("/api/system/updates?force=true");
      if (res.ok) {
        setUpdateInfo(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id: string, action: string) => {
    try {
      await fetch(`/api/containers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return <div className="text-center py-16 text-slate-400">Loading Master Panel...</div>;
  }

  const filteredContainers = containers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 border-b border-slate-200  pb-4">
        <div className="h-10 w-10 rounded-xl bg-slate-900  text-white flex items-center justify-center shadow-md">
          <Cpu className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 ">Master Panel</h1>
          <p className="text-sm text-slate-500 ">System overview and global container management</p>
        </div>
      </div>

      {/* Top Section: System Specs & Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">Docker Status</CardTitle>
            <Server className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {status?.connected ? "Connected" : "Disconnected"}
              <div className={`h-3 w-3 rounded-full ${status?.connected ? "bg-emerald-500" : "bg-red-500"}`} />
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {status?.dockerInfo?.serverVersion || "Unknown version"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.system?.loadAvg?.[0]?.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {status?.system?.cpuCount} Cores • {status?.system?.cpuModel}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.system?.memory?.percent || 0}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {Math.round((status?.system?.memory?.used || 0) / 1024 / 1024 / 1024 * 10) / 10} GB /{" "}
              {Math.round((status?.system?.memory?.total || 0) / 1024 / 1024 / 1024 * 10) / 10} GB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">Global Containers</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{containers.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-semibold">{status?.runningContainers || 0}</span> running,{" "}
              <span className="text-slate-600">{status?.stoppedContainers || 0}</span> stopped
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Update & Release Management Hub */}
      <Card id="updates" className="border border-slate-200/90 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Cowbox Release & Update Center
                {updateInfo?.hasUpdate ? (
                  <Badge variant="warning" className="text-[10px] uppercase font-bold animate-pulse">
                    Update Available
                  </Badge>
                ) : (
                  <Badge variant="success" className="text-[10px] uppercase font-bold">
                    Up to Date
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-slate-500">
                Automated continuous update checker syncing with PyPI & GitHub
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualCheck}
            disabled={isCheckingUpdate}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isCheckingUpdate ? "animate-spin" : ""}`} />
            {isCheckingUpdate ? "Checking..." : "Check for Updates"}
          </Button>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Installed Version */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Installed Version
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black font-mono text-slate-800">
                  v{updateInfo?.currentVersion || "0.2.1"}
                </span>
                <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 font-medium">
                  Active
                </span>
              </div>
            </div>

            {/* PyPI Version */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Latest on PyPI
              </span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black font-mono text-pink-600">
                  v{updateInfo?.pypi?.version || "0.2.1"}
                </span>
                <a
                  href={updateInfo?.pypi?.url || "https://pypi.org/project/cowbox/"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-500 hover:text-pink-600 flex items-center gap-1 font-medium"
                >
                  PyPI <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* GitHub Release */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Latest on GitHub
              </span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black font-mono text-emerald-600">
                  v{updateInfo?.github?.version || "0.2.1"}
                </span>
                <a
                  href={updateInfo?.github?.url || "https://github.com/swapnashu/cowbox"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1 font-medium"
                >
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Update Available Box */}
          {updateInfo?.hasUpdate ? (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-900 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-amber-600" />
                  <span className="font-bold text-sm">
                    New version v{updateInfo.latestVersion} is available!
                  </span>
                </div>
                <span className="text-xs text-amber-700 font-medium">
                  {updateInfo.pypi.publishedAt
                    ? `Released ${new Date(updateInfo.pypi.publishedAt).toLocaleDateString()}`
                    : ""}
                </span>
              </div>

              {/* Upgrade Command snippet */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-amber-800">
                  Upgrade your Cowbox instance:
                </span>
                <div className="flex items-center justify-between bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-xs shadow-inner">
                  <code className="text-pink-400">
                    {updateInfo.instructions.pip}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(updateInfo.instructions.pip)}
                    className="h-6 px-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-800"
                  >
                    {copiedCmd ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedCmd ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>
                Your Cowbox cluster is currently running the latest official version (v{updateInfo?.currentVersion || "0.2.1"}).
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Middle Section: Dense Container Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100  flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 ">All Containers</CardTitle>
            <p className="text-xs text-slate-500 ">Manage any container across the system</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 " />
            <Input
              type="text"
              placeholder="Search containers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500  uppercase bg-slate-50/50  border-b border-slate-100 ">
              <tr>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Name / ID</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Image</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {filteredContainers.map((c) => {
                const isRunning = c.state === "running";
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 :bg-slate-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${isRunning ? "bg-emerald-500" : "bg-slate-300 "}`} />
                        <span className="text-xs font-medium capitalize text-slate-600 ">{c.state}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 ">{c.name}</div>
                      <div className="text-[10px] text-slate-400  font-mono mt-0.5">{c.shortId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="capitalize text-[10px]">
                        {c.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-600 truncate max-w-xs font-mono" title={c.image}>
                        {c.image}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isRunning ? (
                          <>
                            <button
                              onClick={() => handleAction(c.id, "restart")}
                              title="Restart"
                              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                            >
                              <RotateCw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAction(c.id, "stop")}
                              title="Stop"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Square className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <Button
                            onClick={() => handleAction(c.id, "start")}
                            size="sm"
                            variant="success"
                            className="h-7 px-2 text-[10px] gap-1"
                          >
                            <Play className="h-3 w-3" />
                            Start
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredContainers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No containers found matching "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
