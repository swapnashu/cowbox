"use client";

import { useState, useEffect } from "react";
import {
  Server,
  Play,
  Square,
  RotateCw,
  Pause,
  Trash2,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  Database,
  ShieldCheck,
  Search,
  RefreshCw,
  Info,
  Sliders,
  ExternalLink,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export default function RunningServicesPage() {
  const [containers, setContainers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedContainer, setSelectedContainer] = useState<any>(null);
  const [containerDetails, setContainerDetails] = useState<any>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isBatchOperating, setIsBatchOperating] = useState(false);

  const fetchContainers = async () => {
    try {
      const res = await fetch("/api/containers");
      if (res.ok) {
        const data = await res.json();
        setContainers(data.containers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/containers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setActionMessage(`Container action "${action}" executed successfully.`);
        setTimeout(() => setActionMessage(null), 3000);
        fetchContainers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestartAll = async () => {
    if (!confirm("Restart all running containers on the server?")) return;
    setIsBatchOperating(true);
    try {
      const res = await fetch("/api/containers/restart-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(data.message || "All containers restarted.");
        setTimeout(() => setActionMessage(null), 3000);
        fetchContainers();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handlePruneDocker = async () => {
    if (!confirm("Prune all stopped containers and unused images? This reclaims disk space.")) return;
    setIsBatchOperating(true);
    try {
      const res = await fetch("/api/containers/prune", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(data.message || "Docker storage cleaned.");
        setTimeout(() => setActionMessage(null), 4000);
        fetchContainers();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsBatchOperating(false);
    }
  };

  const openInspectModal = async (c: any) => {
    setSelectedContainer(c);
    setIsInspecting(true);
    try {
      const res = await fetch(`/api/containers/${c.id}`);
      if (res.ok) {
        setContainerDetails(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const runningCount = containers.filter((c) => c.state === "running").length;
  const stoppedCount = containers.filter((c) => c.state !== "running").length;

  const filtered = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase()) ||
      c.shortId.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (categoryFilter === "all") return true;
    if (categoryFilter === "running") return c.state === "running";
    if (categoryFilter === "stopped") return c.state !== "running";
    return c.category === categoryFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-emerald-600" />
            Cluster Services & Container Manager
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            1-click lifecycle controls, live telemetry, and zero-downtime container management.
          </p>
        </div>

        {/* Global Control Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRestartAll}
            isLoading={isBatchOperating}
            variant="outline"
            size="sm"
            className="gap-1.5 font-bold text-slate-700 hover:text-pink-600 hover:border-pink-300"
          >
            <RotateCw className="h-3.5 w-3.5 text-pink-500" />
            Restart All Services
          </Button>

          <Button
            onClick={handlePruneDocker}
            isLoading={isBatchOperating}
            variant="outline"
            size="sm"
            className="gap-1.5 font-bold text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Prune & Clean Docker
          </Button>

          <Button onClick={fetchContainers} variant="ghost" size="sm" className="gap-1.5 font-semibold text-slate-700">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-pink-500" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {actionMessage}
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="hover:border-emerald-300 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Running Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {runningCount}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-slate-300 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Stopped / Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-600">{stoppedCount}</div>
          </CardContent>
        </Card>

        <Card className="hover:border-pink-300 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Total Managed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-pink-600">
              {containers.filter((c) => c.isManaged).length}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-slate-300 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Total Containers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{containers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", label: `All (${containers.length})` },
            { id: "running", label: `Running (${runningCount})` },
            { id: "application", label: "Applications" },
            { id: "database", label: "Databases" },
            { id: "proxy", label: "Traefik & Proxy" },
            { id: "stopped", label: "Stopped" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                categoryFilter === tab.id
                  ? "bg-pink-50 text-pink-600 border border-pink-200 shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search containers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Containers List */}
      <Card className="overflow-hidden shadow-sm">
        {isLoading && containers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Loading running containers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No containers found matching filter.</div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200 mt-0.5">
                    {c.category === "application" ? (
                      <Layers className="h-5 w-5 text-pink-600" />
                    ) : c.category === "database" ? (
                      <Database className="h-5 w-5 text-amber-500" />
                    ) : c.category === "proxy" ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Server className="h-5 w-5 text-slate-500" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                      <Badge
                        variant={c.state === "running" ? "success" : "secondary"}
                        className="text-[10px] capitalize font-bold"
                      >
                        {c.state}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono text-slate-500">
                        {c.shortId}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                      <span>Image: <strong className="text-slate-700">{c.image}</strong></span>
                      <span>Status: {c.status}</span>
                      {c.ports && c.ports.length > 0 && (
                        <span className="text-pink-600 font-semibold">
                          Ports: {c.ports.map((p: any) => `${p.PublicPort ? `${p.PublicPort}:` : ""}${p.PrivatePort}`).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Control Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => openInspectModal(c)}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1 text-slate-700"
                  >
                    <Info className="h-3.5 w-3.5" />
                    Inspect
                  </Button>

                  {c.state === "running" ? (
                    <>
                      <Button
                        onClick={() => handleAction(c.id, "restart")}
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-bold gap-1 text-slate-700 hover:text-slate-900"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Restart
                      </Button>
                      <Button
                        onClick={() => handleAction(c.id, "stop")}
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs font-bold gap-1 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                      >
                        <Square className="h-3.5 w-3.5" />
                        Stop
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleAction(c.id, "start")}
                      variant="success"
                      size="sm"
                      className="h-8 text-xs font-bold gap-1"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </Button>
                  )}

                  <Button
                    onClick={() => {
                      if (confirm(`Remove container ${c.name}?`)) handleAction(c.id, "remove");
                    }}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Container Inspect Modal */}
      <Modal
        isOpen={isInspecting}
        onClose={() => setIsInspecting(false)}
        title={`Container Inspection: ${selectedContainer?.name}`}
        description={`ID: ${selectedContainer?.id}`}
        maxWidth="2xl"
      >
        {containerDetails ? (
          <div className="space-y-4 text-xs">
            {/* Quick State Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium block">State</span>
                <span className="font-bold text-slate-900 capitalize mt-0.5 block">{containerDetails.state?.Status}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium block">Process ID (PID)</span>
                <span className="font-mono font-bold text-emerald-600 mt-0.5 block">{containerDetails.state?.Pid || "N/A"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium block">Restart Policy</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{containerDetails.hostConfig?.restartPolicy?.Name || "default"}</span>
              </div>
            </div>

            {/* Network & IP */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 block text-sm">Networking Settings</span>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>IP Address: <strong className="text-slate-800 font-mono">{containerDetails.networkSettings?.ipAddress || "cowbox-network"}</strong></div>
                <div>Gateway: <strong className="text-slate-800 font-mono">{containerDetails.networkSettings?.gateway || "N/A"}</strong></div>
                <div>MAC: <strong className="text-slate-800 font-mono">{containerDetails.networkSettings?.macAddress || "N/A"}</strong></div>
                <div>Network Mode: <strong className="text-slate-800 font-mono">{containerDetails.hostConfig?.networkMode}</strong></div>
              </div>
            </div>

            {/* Volumes & Mounts */}
            {containerDetails.mounts && containerDetails.mounts.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block text-sm">Mounted Volumes</span>
                <div className="space-y-1.5">
                  {containerDetails.mounts.map((m: any, idx: number) => (
                    <div key={idx} className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200 text-slate-700">
                      <strong>{m.Name || m.Source}</strong> → {m.Destination} ({m.Mode || "rw"})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Environment Variables */}
            {containerDetails.config?.env && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block text-sm">Environment Configuration</span>
                <div className="max-h-36 overflow-y-auto font-mono text-[11px] bg-slate-900 text-emerald-400 p-3 rounded-lg leading-relaxed">
                  {containerDetails.config.env.map((e: string, i: number) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">Loading container telemetry...</div>
        )}
      </Modal>

      {/* Docker Network Topology Section */}
      <div className="space-y-4 pt-6 border-t border-slate-200 mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Docker Network Topology
          </h2>
        </div>
        <NetworkTopology />
      </div>
    </div>
  );
}

function NetworkTopology() {
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/networks")
      .then(res => res.json())
      .then(data => setNetworks(data.networks || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading network topology...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {networks.map((net) => {
        const isCowbox = net.name === "cowbox-network";
        return (
          <Card key={net.id} className={`hover:shadow-md transition-all ${isCowbox ? "border-pink-300 ring-1 ring-pink-500/20 bg-gradient-to-br from-pink-50/50 to-white" : ""}`}>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-mono text-slate-800 flex items-center gap-2">
                  {net.name}
                  {isCowbox && <Badge variant="pink" className="text-[10px] uppercase tracking-wider">Primary</Badge>}
                </CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500">{net.driver}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {net.containers && net.containers.length > 0 ? (
                <div className="space-y-2">
                  {net.containers.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-700 truncate max-w-[140px]">{c.name}</span>
                      <span className="font-mono text-slate-500">{c.ipv4}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400 font-medium">No containers connected</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
