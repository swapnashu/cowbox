"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  HardDrive,
  Cpu,
  Network,
  Trash2,
  Download,
  Plus,
  RefreshCw,
  Search,
  Play,
  Square,
  RotateCw,
  Terminal,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  Globe,
  Sliders,
  Eye,
  Check,
  Clock,
  Radio,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatBytes } from "@/lib/utils";
import { InteractiveTerminal } from "@/components/docker/interactive-terminal";

type TabType = "containers" | "images" | "volumes" | "networks" | "builder" | "terminal";

export default function DockerHubPage() {
  const [activeTab, setActiveTab] = useState<TabType>("containers");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Data states
  const [containers, setContainers] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [builderStats, setBuilderStats] = useState<any>(null);

  // Modals
  const [isPullImageModal, setIsPullImageModal] = useState(false);
  const [pullImageInput, setPullImageInput] = useState("");
  const [isPulling, setIsPulling] = useState(false);

  const [isCreateVolumeModal, setIsCreateVolumeModal] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState("");
  const [isCreatingVolume, setIsCreatingVolume] = useState(false);

  const [isCreateNetworkModal, setIsCreateNetworkModal] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkDriver, setNewNetworkDriver] = useState("bridge");
  const [isCreatingNetwork, setIsCreatingNetwork] = useState(false);

  const [inspectModalData, setInspectModalData] = useState<any>(null);
  const [activeTerminalContainer, setActiveTerminalContainer] = useState<any>(null);
  const [isPruning, setIsPruning] = useState(false);

  const showStatus = (text: string, type: "success" | "error" = "success") => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchAllDockerData = async () => {
    setIsLoading(true);
    try {
      const [cRes, iRes, vRes, nRes, bRes] = await Promise.all([
        fetch("/api/containers"),
        fetch("/api/docker/images"),
        fetch("/api/docker/volumes"),
        fetch("/api/docker/networks"),
        fetch("/api/docker/builder"),
      ]);

      if (cRes.ok) {
        const d = await cRes.json();
        setContainers(d.containers || []);
        if (!activeTerminalContainer && d.containers?.length > 0) {
          setActiveTerminalContainer(d.containers[0]);
        }
      }
      if (iRes.ok) {
        const d = await iRes.json();
        setImages(d.images || []);
      }
      if (vRes.ok) {
        const d = await vRes.json();
        setVolumes(d.volumes || []);
      }
      if (nRes.ok) {
        const d = await nRes.json();
        setNetworks(d.networks || []);
      }
      if (bRes.ok) {
        const d = await bRes.json();
        setBuilderStats(d);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDockerData();
    const timer = setInterval(fetchAllDockerData, 12000);
    return () => clearInterval(timer);
  }, []);

  // Container Action
  const handleContainerAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/containers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(`Container ${action} executed successfully`);
        fetchAllDockerData();
      } else {
        showStatus(data.error || "Action failed", "error");
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    }
  };

  // Pull Image
  const handlePullImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullImageInput.trim()) return;
    setIsPulling(true);
    try {
      const res = await fetch("/api/docker/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: pullImageInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message || "Image pulled successfully");
        setIsPullImageModal(false);
        setPullImageInput("");
        fetchAllDockerData();
      } else {
        showStatus(data.error || "Failed to pull image", "error");
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    } finally {
      setIsPulling(false);
    }
  };

  // Delete Image
  const handleDeleteImage = async (id: string) => {
    if (!confirm("Are you sure you want to remove this Docker image?")) return;
    try {
      const res = await fetch(`/api/docker/images?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message);
        fetchAllDockerData();
      } else {
        showStatus(data.error, "error");
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    }
  };

  // Prune Dangling Images
  const handlePruneDanglingImages = async () => {
    try {
      const res = await fetch("/api/docker/images?dangling=true", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message);
        fetchAllDockerData();
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    }
  };

  // Create Volume
  const handleCreateVolume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVolumeName.trim()) return;
    setIsCreatingVolume(true);
    try {
      const res = await fetch("/api/docker/volumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newVolumeName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message);
        setIsCreateVolumeModal(false);
        setNewVolumeName("");
        fetchAllDockerData();
      } else {
        showStatus(data.error, "error");
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    } finally {
      setIsCreatingVolume(false);
    }
  };

  // Delete Volume
  const handleDeleteVolume = async (name: string) => {
    if (!confirm(`Delete Docker volume "${name}"? Persistent data inside this volume will be erased.`)) return;
    try {
      const res = await fetch(`/api/docker/volumes?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message);
        fetchAllDockerData();
      } else {
        showStatus(data.error, "error");
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    }
  };

  // Create Network
  const handleCreateNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNetworkName.trim()) return;
    setIsCreatingNetwork(true);
    try {
      const res = await fetch("/api/docker/networks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNetworkName.trim(), driver: newNetworkDriver }),
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message);
        setIsCreateNetworkModal(false);
        setNewNetworkName("");
        fetchAllDockerData();
      } else {
        showStatus(data.error, "error");
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    } finally {
      setIsCreatingNetwork(false);
    }
  };

  // Delete Network
  const handleDeleteNetwork = async (id: string) => {
    if (!confirm("Are you sure you want to remove this network?")) return;
    try {
      const res = await fetch(`/api/docker/networks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message);
        fetchAllDockerData();
      } else {
        showStatus(data.error, "error");
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    }
  };

  // Prune Builder Cache
  const handlePruneBuilderCache = async () => {
    if (!confirm("Prune all BuildKit build cache layers? This reclaims storage space without affecting running containers.")) return;
    setIsPruning(true);
    try {
      const res = await fetch("/api/docker/builder", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message);
        fetchAllDockerData();
      } else {
        showStatus(data.error, "error");
      }
    } catch (e: any) {
      showStatus(e.message, "error");
    } finally {
      setIsPruning(false);
    }
  };

  // Filtered lists
  const filteredContainers = containers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase()) ||
      c.shortId.toLowerCase().includes(search.toLowerCase())
  );

  const filteredImages = images.filter(
    (img) =>
      img.primaryTag.toLowerCase().includes(search.toLowerCase()) ||
      img.shortId.toLowerCase().includes(search.toLowerCase())
  );

  const filteredVolumes = volumes.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredNetworks = networks.filter((n) =>
    n.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-black">
              🐳
            </div>
            Docker Management Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time management for Docker containers, image repositories, volumes, networks, and build cache.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAllDockerData}
            isLoading={isLoading}
            className="gap-1.5 border-slate-200"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            Refresh
          </Button>

          {activeTab === "images" && (
            <Button
              size="sm"
              onClick={() => setIsPullImageModal(true)}
              className="gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-md shadow-pink-500/20"
            >
              <Download className="h-4 w-4" />
              Pull Image
            </Button>
          )}

          {activeTab === "volumes" && (
            <Button
              size="sm"
              onClick={() => setIsCreateVolumeModal(true)}
              className="gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-md shadow-pink-500/20"
            >
              <Plus className="h-4 w-4" />
              Create Volume
            </Button>
          )}

          {activeTab === "networks" && (
            <Button
              size="sm"
              onClick={() => setIsCreateNetworkModal(true)}
              className="gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-md shadow-pink-500/20"
            >
              <Plus className="h-4 w-4" />
              Create Network
            </Button>
          )}

          {activeTab === "builder" && (
            <Button
              size="sm"
              onClick={handlePruneBuilderCache}
              isLoading={isPruning}
              className="gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-md shadow-pink-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Prune Build Cache
            </Button>
          )}
        </div>
      </div>

      {/* Status Message Notification */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in duration-150 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">{containers.length}</div>
            <div className="text-[11px] text-slate-500 font-medium">Containers</div>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">{images.length}</div>
            <div className="text-[11px] text-slate-500 font-medium">Images</div>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">{volumes.length}</div>
            <div className="text-[11px] text-slate-500 font-medium">Volumes</div>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">{networks.length}</div>
            <div className="text-[11px] text-slate-500 font-medium">Networks</div>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">
              {builderStats ? formatBytes(builderStats.totalBytes) : "0 MB"}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Build Cache</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("containers")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "containers"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Containers ({containers.length})
          </button>
          <button
            onClick={() => setActiveTab("images")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "images"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Images ({images.length})
          </button>
          <button
            onClick={() => setActiveTab("volumes")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "volumes"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Volumes ({volumes.length})
          </button>
          <button
            onClick={() => setActiveTab("networks")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "networks"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Networks ({networks.length})
          </button>
          <button
            onClick={() => setActiveTab("builder")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "builder"
                ? "bg-white text-pink-600 shadow-sm"
                : "text-slate-600 hover:text-pink-600"
            }`}
          >
            ⚡ Build Cache Manager
          </button>
          <button
            onClick={() => setActiveTab("terminal")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "terminal"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Terminal Shell
          </button>
        </div>

        {activeTab !== "builder" && activeTab !== "terminal" && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-white"
            />
          </div>
        )}
      </div>

      {/* TAB 1: CONTAINERS */}
      {activeTab === "containers" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Container</th>
                    <th className="p-3.5">Image</th>
                    <th className="p-3.5">State</th>
                    <th className="p-3.5">Ports</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContainers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No containers found.
                      </td>
                    </tr>
                  ) : (
                    filteredContainers.map((c) => {
                      const isRunning = c.state === "running";
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {c.isManaged && (
                                <Badge className="bg-pink-50 text-pink-600 border-pink-200 text-[9px] px-1 py-0">
                                  Managed
                                </Badge>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-slate-400">{c.shortId}</span>
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-slate-600 truncate max-w-[200px]">
                            {c.image}
                          </td>
                          <td className="p-3.5">
                            <Badge
                              className={`text-[10px] capitalize ${
                                isRunning
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full mr-1 ${
                                  isRunning ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                              ></span>
                              {c.state}
                            </Badge>
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1">
                              {(c.ports || []).map((p: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                                >
                                  {p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : p.PrivatePort}
                                </span>
                              ))}
                              {(!c.ports || c.ports.length === 0) && (
                                <span className="text-slate-400 text-[11px]">&mdash;</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase">
                              {c.category}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isRunning ? (
                                <button
                                  onClick={() => handleContainerAction(c.id, "stop")}
                                  title="Stop container"
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-rose-600 transition-colors"
                                >
                                  <Square className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleContainerAction(c.id, "start")}
                                  title="Start container"
                                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-colors"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleContainerAction(c.id, "restart")}
                                title="Restart container"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setActiveTerminalContainer(c);
                                  setActiveTab("terminal");
                                }}
                                title="Open Terminal"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-pink-600 transition-colors"
                              >
                                <Terminal className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  const res = await fetch(`/api/containers/${c.id}`);
                                  if (res.ok) setInspectModalData(await res.json());
                                }}
                                title="Inspect container"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleContainerAction(c.id, "remove")}
                                title="Remove container"
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IMAGES */}
      {activeTab === "images" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-600">
              Total Image Storage:{" "}
              <strong className="text-slate-900">
                {formatBytes(images.reduce((sum, img) => sum + (img.sizeBytes || 0), 0))}
              </strong>{" "}
              across {images.length} images.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePruneDanglingImages}
              className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Prune Dangling Layers
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Repository / Tag</th>
                    <th className="p-3.5">Image ID</th>
                    <th className="p-3.5">Size</th>
                    <th className="p-3.5">Created</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredImages.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No Docker images found.
                      </td>
                    </tr>
                  ) : (
                    filteredImages.map((img) => (
                      <tr key={img.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">
                          {img.primaryTag}
                          {img.tags.length > 1 && (
                            <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                              (+{img.tags.length - 1} more tag)
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-500">{img.shortId}</td>
                        <td className="p-3.5 font-semibold text-slate-700">{formatBytes(img.sizeBytes)}</td>
                        <td className="p-3.5 text-slate-500">
                          {new Date(img.created * 1000).toLocaleDateString()}
                        </td>
                        <td className="p-3.5">
                          {img.isDangling ? (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              Dangling
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              Tagged
                            </Badge>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleDeleteImage(img.id)}
                            title="Remove image"
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VOLUMES */}
      {activeTab === "volumes" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVolumes.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-400" />
                No Docker volumes found.
              </div>
            ) : (
              filteredVolumes.map((vol) => (
                <div
                  key={vol.name}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                          <HardDrive className="h-4 w-4" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 truncate max-w-[180px]">{vol.name}</h4>
                      </div>
                      <Badge
                        className={`text-[10px] ${
                          vol.isInUse
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {vol.isInUse ? "In Use" : "Unused"}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500 mt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Driver:</span>
                        <span className="font-mono text-slate-700">{vol.driver}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Scope:</span>
                        <span className="text-slate-700 capitalize">{vol.scope}</span>
                      </div>
                      {vol.attachedContainers.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Attached To:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {vol.attachedContainers.map((ac: any) => (
                              <span
                                key={ac.id}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]"
                              >
                                {ac.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteVolume(vol.name)}
                      className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: NETWORKS */}
      {activeTab === "networks" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNetworks.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <Network className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-400" />
                No Docker networks found.
              </div>
            ) : (
              filteredNetworks.map((net) => (
                <div
                  key={net.id}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                          <Network className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{net.name}</h4>
                          <span className="font-mono text-[10px] text-slate-400">{net.shortId}</span>
                        </div>
                      </div>
                      <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] uppercase">
                        {net.driver}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500 mt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Subnet:</span>
                        <span className="font-mono text-slate-700 text-[11px]">{net.subnet}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gateway:</span>
                        <span className="font-mono text-slate-700 text-[11px]">{net.gateway}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Connected:</span>
                        <span className="font-bold text-slate-800">{net.containersCount} container(s)</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
                    {net.name !== "bridge" && net.name !== "host" && net.name !== "null" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteNetwork(net.id)}
                        className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: BUILD CACHE MANAGER */}
      {activeTab === "builder" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-pink-600" />
                BuildKit & Docker Build Cache Inspector
              </CardTitle>
              <CardDescription>
                Inspect cached layer snapshots, reclaimed disk space, and accelerate subsequent builds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Storage Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Total Cache Storage
                  </span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {builderStats ? formatBytes(builderStats.totalBytes) : "0 MB"}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {builderStats?.layersCount || 0} active snapshot layer(s)
                  </span>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
                    Reclaimable Space
                  </span>
                  <span className="text-2xl font-black text-emerald-700 mt-1 block">
                    {builderStats ? formatBytes(builderStats.reclaimableBytes) : "0 MB"}
                  </span>
                  <span className="text-[11px] text-emerald-600 mt-0.5 block">
                    Ready to prune safely
                  </span>
                </div>

                <div className="p-4 bg-pink-50 rounded-xl border border-pink-200 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-pink-600 uppercase tracking-wider block">
                      1-Click Cache Cleaner
                    </span>
                    <span className="text-xs text-pink-700 mt-1 block">
                      Reclaim storage from completed builds
                    </span>
                  </div>
                  <Button
                    onClick={handlePruneBuilderCache}
                    isLoading={isPruning}
                    className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-md shadow-pink-500/20 text-xs mt-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Prune Build Cache Now
                  </Button>
                </div>
              </div>

              {/* Build Cache Layer Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                  Cached Build Layers
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Layer ID</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Size</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!builderStats?.items || builderStats.items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">
                            Build cache is currently clean (0 cached layers).
                          </td>
                        </tr>
                      ) : (
                        builderStats.items.slice(0, 15).map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="p-3 font-mono text-[11px] text-slate-700">{item.id}</td>
                            <td className="p-3 text-slate-600 font-semibold">{item.type}</td>
                            <td className="p-3 text-slate-500 truncate max-w-[250px]">{item.description}</td>
                            <td className="p-3 font-semibold text-slate-800">{formatBytes(item.sizeBytes)}</td>
                            <td className="p-3">
                              {item.inUse ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                  Active
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                                  Reclaimable
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 6: INTERACTIVE TERMINAL */}
      {activeTab === "terminal" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Target Container:</span>
              <select
                value={activeTerminalContainer?.id || ""}
                onChange={(e) => {
                  const target = containers.find((c) => c.id === e.target.value);
                  if (target) setActiveTerminalContainer(target);
                }}
                className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold bg-slate-50 text-slate-800"
              >
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.shortId}) &mdash; {c.state}
                  </option>
                ))}
              </select>
            </div>
            {activeTerminalContainer && (
              <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-mono">
                {activeTerminalContainer.image}
              </Badge>
            )}
          </div>

          {activeTerminalContainer ? (
            <div className="h-[560px]">
              <InteractiveTerminal
                key={activeTerminalContainer.id}
                containerId={activeTerminalContainer.id}
                containerName={activeTerminalContainer.name}
              />
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
              No containers available for shell session.
            </div>
          )}
        </div>
      )}

      {/* MODAL: Pull Image */}
      <Modal isOpen={isPullImageModal} onClose={() => setIsPullImageModal(false)} title="Pull Docker Image">
        <form onSubmit={handlePullImage} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Image Name & Tag</label>
            <Input
              placeholder="e.g. redis:alpine, postgres:16, ghcr.io/..."
              value={pullImageInput}
              onChange={(e) => setPullImageInput(e.target.value)}
              required
            />
            <p className="text-[11px] text-slate-400">Pulls directly from Docker Hub, GHCR, or custom container registry.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsPullImageModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isPulling}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold"
            >
              Pull Image
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Create Volume */}
      <Modal isOpen={isCreateVolumeModal} onClose={() => setIsCreateVolumeModal(false)} title="Create Docker Volume">
        <form onSubmit={handleCreateVolume} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Volume Name</label>
            <Input
              placeholder="e.g. my_app_storage"
              value={newVolumeName}
              onChange={(e) => setNewVolumeName(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateVolumeModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isCreatingVolume}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold"
            >
              Create Volume
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Create Network */}
      <Modal isOpen={isCreateNetworkModal} onClose={() => setIsCreateNetworkModal(false)} title="Create Docker Network">
        <form onSubmit={handleCreateNetwork} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Network Name</label>
            <Input
              placeholder="e.g. isolated-tier-net"
              value={newNetworkName}
              onChange={(e) => setNewNetworkName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Driver</label>
            <select
              value={newNetworkDriver}
              onChange={(e) => setNewNetworkDriver(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
            >
              <option value="bridge">bridge (standard)</option>
              <option value="host">host</option>
              <option value="overlay">overlay (swarm)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateNetworkModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isCreatingNetwork}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold"
            >
              Create Network
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Inspect Container */}
      <Modal
        isOpen={Boolean(inspectModalData)}
        onClose={() => setInspectModalData(null)}
        title={`Container Inspection: ${inspectModalData?.name || ""}`}
      >
        <div className="space-y-3 max-h-[500px] overflow-y-auto font-mono text-xs">
          <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[11px] leading-relaxed">
            {JSON.stringify(inspectModalData, null, 2)}
          </pre>
        </div>
      </Modal>
    </div>
  );
}
