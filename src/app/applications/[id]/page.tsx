"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  Play,
  RotateCw,
  Square,
  Trash2,
  Globe,
  Terminal,
  FileCode,
  Sliders,
  Clock,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Wand2,
  Database,
  Link2,
  Copy,
  Check,
  GitBranch,
  Plus,
  Lock,
  Radio,
  CheckCircle2,
  Loader2,
  Sparkles,
  Download,
  Upload,
  Cpu,
  HardDrive,
  Activity,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SparklineChart } from "@/components/ui/sparkline-chart";
import { InteractiveTerminal } from "@/components/docker/interactive-terminal";
import { generateSslipDomain } from "@/lib/domain";
import { formatBytes } from "@/lib/utils";

type TabType = "overview" | "terminal" | "domains" | "deployments" | "logs" | "env" | "settings";

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.id as string;

  const [app, setApp] = useState<any>(null);
  const [projectDbs, setProjectDbs] = useState<any[]>([]);
  const [domainsList, setDomainsList] = useState<any[]>([]);
  const [serverIp, setServerIp] = useState<string>("127.0.0.1");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [logs, setLogs] = useState<string[]>(["Loading logs..."]);
  const [envVars, setEnvVars] = useState<string>("");
  const [customDomainInput, setCustomDomainInput] = useState<string>("");
  const [customHttps, setCustomHttps] = useState<boolean>(true);
  const [memoryLimit, setMemoryLimit] = useState<string>("");
  const [cpuLimit, setCpuLimit] = useState<string>("");
  const [restartPolicy, setRestartPolicy] = useState<string>("unless-stopped");
  const [autoDeployEnabled, setAutoDeployEnabled] = useState<boolean>(false);
  const [isTogglingAutoDeploy, setIsTogglingAutoDeploy] = useState<boolean>(false);

  // In-Container Web Terminal State
  const [shellCommand, setShellCommand] = useState("");
  const [shellHistory, setShellHistory] = useState<Array<{ cmd: string; out: string; success: boolean }>>([]);
  const [isExecutingShell, setIsExecutingShell] = useState(false);

  // Live Performance Stats
  const [liveStats, setLiveStats] = useState<any>(null);
  const [historyStats, setHistoryStats] = useState<any[]>([]);

  // Live Deployment Screen State
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [deployStep, setDeployStep] = useState<number>(1);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [deployDuration, setDeployDuration] = useState<number>(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [logSearch, setLogSearch] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  
  // Rollback State
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [rollbackDeploymentId, setRollbackDeploymentId] = useState<string>("");
  const [isRollingBack, setIsRollingBack] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchApp = async () => {
    try {
      const [appRes, statusRes, domRes] = await Promise.all([
        fetch(`/api/applications/${appId}`),
        fetch(`/api/server/status`),
        fetch(`/api/domains?applicationId=${appId}`),
      ]);

      if (appRes.ok) {
        const data = await appRes.json();
        setApp(data);
        setEnvVars(data.envVars || "");
        setMemoryLimit(data.memoryLimit || "");
        setCpuLimit(data.cpuLimit || "");
        setRestartPolicy(data.restartPolicy || "unless-stopped");
        setAutoDeployEnabled(Boolean(data.autoDeploy));

        if (data.projectId) {
          const dbsRes = await fetch(`/api/databases?projectId=${data.projectId}`);
          if (dbsRes.ok) setProjectDbs(await dbsRes.json());
        }

        // Fetch container live stats if running
        if (data.containerId) {
          fetchContainerStats(data.containerId);
        }
      } else {
        router.push("/projects");
      }

      if (statusRes.ok) {
        const s = await statusRes.json();
        if (s.serverIp) setServerIp(s.serverIp);
      }

      if (domRes.ok) {
        const dData = await domRes.json();
        setDomainsList(dData.domains || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContainerStats = async (cId: string) => {
    try {
      const res = await fetch(`/api/containers/${cId}/stats`);
      if (res.ok) {
        setLiveStats(await res.json());
      }
      const histRes = await fetch(`/api/monitoring?containerId=${cId}`);
      if (histRes.ok) {
        setHistoryStats(await histRes.json());
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchApp();
  }, [appId]);

  useEffect(() => {
    let evtSource: EventSource | null = null;
    if (activeTab === "logs") {
      setLogs([]);
      evtSource = new EventSource(`/api/applications/${appId}/logs/stream`);
      
      evtSource.onmessage = (event) => {
        setLogs((prev) => {
          const newLogs = [...prev, event.data];
          // auto scroll
          setTimeout(() => {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 50);
          return newLogs;
        });
      };

      evtSource.onerror = () => {
        setLogs((prev) => [...prev, "Connection lost or no logs available."]);
        evtSource?.close();
      };
    }

    if (activeTab === "overview" && app?.containerId) {
      const interval = setInterval(() => fetchContainerStats(app.containerId), 5000);
      return () => {
        clearInterval(interval);
        if (evtSource) evtSource.close();
      };
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, [activeTab, appId, app?.containerId]);

  const handleAutoSslip = () => {
    if (app) {
      setCustomDomainInput(generateSslipDomain(app.name, serverIp));
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDomainInput.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: appId,
          domain: customDomainInput.trim(),
          https: customHttps,
        }),
      });
      if (res.ok) {
        setCustomDomainInput("");
        await fetchApp();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm("Are you sure you want to remove this domain route?")) return;
    try {
      const res = await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
      if (res.ok) fetchApp();
    } catch (e) {}
  };

  const handleLinkDatabase = (selectedDb: any) => {
    const host = `cowbox-db-${selectedDb.name}`;
    const user = selectedDb.databaseUser || "postgres";
    const pass = selectedDb.rootPassword;
    const port = selectedDb.internalPort;
    const dbName = selectedDb.databaseName;
    
    let connUrl = `postgresql://${user}:${pass}@${host}:${port}/${dbName}`;
    if (selectedDb.type === "mysql" || selectedDb.type === "mariadb") {
      connUrl = `mysql://${user}:${pass}@${host}:${port}/${dbName}`;
    } else if (selectedDb.type === "redis") {
      connUrl = `redis://:${pass}@${host}:${port}`;
    } else if (selectedDb.type === "mongodb") {
      connUrl = `mongodb://${user}:${pass}@${host}:${port}/${dbName}`;
    }

    const injected = `\n# Linked Database: ${selectedDb.name} (${selectedDb.type})\nDATABASE_URL=${connUrl}\nDB_HOST=${host}\nDB_PORT=${port}\nDB_USER=${user}\nDB_PASSWORD=${pass}\nDB_NAME=${dbName}\n`;
    setEnvVars((prev) => (prev ? prev.trim() + "\n" + injected : injected.trim()));
  };

  const handleToggleAutoDeploy = async (enabled: boolean) => {
    setIsTogglingAutoDeploy(true);
    try {
      const res = await fetch(`/api/applications/${appId}/auto-deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoDeploy: enabled }),
      });
      if (res.ok) {
        setAutoDeployEnabled(enabled);
        setApp((prev: any) => ({ ...prev, autoDeploy: enabled }));
      }
    } catch (e) {
      console.error("Failed to toggle auto deploy", e);
    } finally {
      setIsTogglingAutoDeploy(false);
    }
  };

  // In-Container Shell Execution
  const handleRunShellCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shellCommand.trim() || !app.containerId) return;

    const cmd = shellCommand.trim();
    setIsExecutingShell(true);
    try {
      const res = await fetch(`/api/containers/${app.containerId}/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      setShellHistory((prev) => [...prev, { cmd, out: data.output || data.error, success: data.success }]);
      setShellCommand("");
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err: any) {
      setShellHistory((prev) => [...prev, { cmd, out: err.message, success: false }]);
    } finally {
      setIsExecutingShell(false);
    }
  };

  // Live Deployment Trigger & Screen
  const handleDeploy = async () => {
    setIsDeploying(true);
    setIsDeployModalOpen(true);
    setDeploySuccess(false);
    setDeployStep(1);
    setDeployDuration(0);
    setDeployLogs([
      `[${new Date().toISOString().substring(11, 19)}] 🐮 [1/4] Preparing Cowbox build workspace for ${app.name}...`,
    ]);

    const timer = setInterval(() => {
      setDeployDuration((d) => d + 1);
    }, 1000);

    try {
      setTimeout(() => {
        setDeployStep(2);
        setDeployLogs((prev) => [
          ...prev,
          `[${new Date().toISOString().substring(11, 19)}] 📦 [2/4] Pulling source image / verifying dependencies...`,
        ]);
      }, 700);

      setTimeout(() => {
        setDeployStep(3);
        setDeployLogs((prev) => [
          ...prev,
          `[${new Date().toISOString().substring(11, 19)}] 🐳 [3/4] Launching container on cowbox-network...`,
        ]);
      }, 1500);

      const res = await fetch(`/api/applications/${appId}/deploy`, { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setDeployStep(4);
        setDeployLogs((prev) => [
          ...prev,
          `[${new Date().toISOString().substring(11, 19)}] 🌐 [4/4] Configuring Traefik dynamic SSL routing & Let's Encrypt...`,
          `[${new Date().toISOString().substring(11, 19)}] 🚀 [SUCCESS] Application is online and healthy!`,
        ]);
        setDeploySuccess(true);
        await fetchApp();
      } else {
        setDeployLogs((prev) => [
          ...prev,
          `[${new Date().toISOString().substring(11, 19)}] ❌ [ERROR] Deployment failed: ${data.error}`,
        ]);
      }
    } catch (e: any) {
      setDeployLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().substring(11, 19)}] ❌ [ERROR] ${e.message}`,
      ]);
    } finally {
      clearInterval(timer);
      setIsDeploying(false);
    }
  };

  const handleRestart = async () => {
    try {
      await fetch(`/api/applications/${appId}/restart`, { method: "POST" });
      fetchApp();
    } catch (e) {}
  };

  const handleCloneToStaging = async () => {
    setIsCloning(true);
    try {
      const res = await fetch(`/api/applications/${appId}/clone`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.application) {
        router.push(`/applications/${data.application.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCloning(false);
    }
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${app?.name || "app"}-logs.log`;
    a.click();
  };

  const handleStop = async () => {
    try {
      await fetch(`/api/applications/${appId}/stop`, { method: "POST" });
      fetchApp();
    } catch (e) {}
  };

  const handleDelete = async () => {
    const promptText = prompt("Type the name of the app to confirm deletion:");
    if (promptText !== app.name) return;
    try {
      const res = await fetch(`/api/applications/${appId}`, { method: "DELETE" });
      if (res.ok) router.push(`/projects/${app.projectId}`);
    } catch (e) {}
  };

  const confirmRollback = (id: string) => {
    setRollbackDeploymentId(id);
    setIsRollbackModalOpen(true);
  };

  const executeRollback = async () => {
    if (!rollbackDeploymentId) return;
    setIsRollingBack(true);
    try {
      const res = await fetch(`/api/applications/${appId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentId: rollbackDeploymentId }),
      });
      if (res.ok) {
        await fetchApp();
        setIsRollbackModalOpen(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleSaveEnv = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envVars }),
      });
      fetchApp();
    } catch (e) {
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportEnv = () => {
    const blob = new Blob([envVars], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${app.name}.env`;
    a.click();
  };

  const handleImportEnv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setEnvVars((prev) => (prev ? prev.trim() + "\n" + content : content));
    };
    reader.readAsText(file);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryLimit, cpuLimit, restartPolicy }),
      });
      fetchApp();
    } catch (e) {
    } finally {
      setIsSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/webhooks/deploy/${appId}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const copyServerIp = () => {
    navigator.clipboard.writeText(serverIp);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  if (isLoading) {
    return <div className="text-center py-16 text-slate-400">Loading application...</div>;
  }

  if (!app) return null;

  const primaryDomain = domainsList[0]?.domain || `${app.name}.${serverIp}.sslip.io`;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${app.projectId}`}
          className="text-xs font-semibold text-pink-600 hover:underline flex items-center gap-1.5 mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Project
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-pink-500/20 font-bold">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">{app.name}</h1>
                <Badge
                  variant={
                    app.status === "running"
                      ? "success"
                      : app.status === "building"
                      ? "warning"
                      : app.status === "error"
                      ? "destructive"
                      : "secondary"
                  }
                  className="capitalize"
                >
                  {app.status}
                </Badge>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Port: {app.containerPort} {app.exposedPort ? `→ Host :${app.exposedPort}` : ""} • Network: cowbox-network
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloneToStaging}
              isLoading={isCloning}
              className="gap-1.5 font-bold text-pink-600 border-pink-200 hover:bg-pink-50"
            >
              <Copy className="h-4 w-4" />
              Clone Staging
            </Button>

            {app.status === "running" ? (
              <>
                <Button variant="outline" size="sm" onClick={handleRestart} className="gap-1.5 font-bold">
                  <RotateCw className="h-4 w-4 text-slate-600" />
                  Restart
                </Button>
                <Button variant="secondary" size="sm" onClick={handleStop} className="gap-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200">
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              </>
            ) : null}

            <Button
              size="sm"
              variant="success"
              onClick={handleDeploy}
              isLoading={isDeploying}
              className="gap-1.5 shadow-md shadow-emerald-500/20 font-bold"
            >
              <Play className="h-4 w-4" />
              Deploy Application
            </Button>

            <Button variant="ghost" size="icon" onClick={handleDelete} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-px overflow-x-auto">
        {(
          [
            { id: "overview", label: "Overview & Telemetry", icon: Layers },
            { id: "terminal", label: "In-Container Shell", icon: Terminal },
            { id: "domains", label: `Domains & DNS (${domainsList.length})`, icon: Globe },
            { id: "deployments", label: "Deployments & Webhooks", icon: Clock },
            { id: "logs", label: "Logs", icon: FileCode },
            { id: "env", label: "Environment & DBs", icon: Database },
            { id: "settings", label: "Settings", icon: Sliders },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-pink-500 text-pink-600 bg-pink-50/50 rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {/* Overview Tab with Live Performance Metrics */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Live Performance Stats Bar */}
            {liveStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-pink-200 bg-gradient-to-tr from-pink-50/40 to-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                      <span>Container CPU</span>
                      <Cpu className="h-4 w-4 text-pink-500" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-extrabold text-pink-600">{liveStats.cpuPercent}%</div>
                    <p className="text-xs text-slate-500 mt-0.5">{liveStats.pids} active thread tasks</p>
                    <div className="mt-4 h-12">
                      <SparklineChart data={historyStats.map(s => s.cpuPercent || 0)} color="#ec4899" height={48} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-200 bg-gradient-to-tr from-emerald-50/40 to-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                      <span>Memory Usage</span>
                      <HardDrive className="h-4 w-4 text-emerald-600" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-extrabold text-emerald-600">
                      {liveStats.memory.percent}%
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      {formatBytes(liveStats.memory.usedBytes)} used
                    </p>
                    <div className="mt-4 h-12">
                      <SparklineChart data={historyStats.map(s => s.memoryPercent || 0)} color="#10b981" height={48} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                      <span>Network I/O</span>
                      <Activity className="h-4 w-4 text-slate-600" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-base font-extrabold text-slate-800 font-mono">
                      ↓ {formatBytes(liveStats.network.rxBytes)} / ↑ {formatBytes(liveStats.network.txBytes)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Bridge traffic</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Application Runtime</CardTitle>
                  <CardDescription>Container engine specs and source repo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 block">Source Type</span>
                      <span className="text-sm font-bold text-slate-800 uppercase mt-0.5 block">
                        {app.appType}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 block">Container ID</span>
                      <span className="text-xs font-mono font-bold text-emerald-600 mt-1 block truncate">
                        {app.containerId ? app.containerId.substring(0, 12) : "Not running"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Source / Image Tag</label>
                    <div className="font-mono text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 break-all font-semibold">
                      {app.appType === "image"
                        ? app.dockerImage || "nginx:alpine"
                        : `${app.gitRepository || "Uploaded Source Code"} (${app.gitBranch})`}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Primary Domain Address</label>
                    <div className="flex items-center gap-2">
                      <a
                        href={`http://${primaryDomain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-pink-600 hover:underline bg-pink-50 px-4 py-2 rounded-xl border border-pink-200 font-mono font-bold"
                      >
                        <Globe className="h-4 w-4" />
                        http://{primaryDomain}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold">Routing Specs</CardTitle>
                  <CardDescription>Traefik dynamic proxy</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Container Port</span>
                    <span className="font-mono font-bold text-slate-800">{app.containerPort}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Host Port Binding</span>
                    <span className="font-mono font-bold text-slate-800">{app.exposedPort || "Dynamic"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Traefik TLS</span>
                    <span className="text-emerald-600 font-bold">Let's Encrypt (ACME)</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Docker Network</span>
                    <span className="font-mono font-semibold text-slate-800">cowbox-network</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* In-Container Web Terminal Tab */}
        {activeTab === "terminal" && (
          <InteractiveTerminal containerId={app.containerId} containerName={app.name} />
        )}

        {/* Custom Domains & DNS Configuration Tab */}
        {activeTab === "domains" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="h-5 w-5 text-pink-600" />
                  Attach Custom Domain or Subdomain
                </CardTitle>
                <CardDescription>
                  Route your own domain (e.g. <code>app.mycompany.com</code>, <code>mybrand.org</code>) or zero-config <code>sslip.io</code> URL.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddDomain} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">Domain Name *</label>
                      <button
                        type="button"
                        onClick={handleAutoSslip}
                        className="text-[11px] font-semibold text-pink-600 hover:underline flex items-center gap-1"
                      >
                        <Wand2 className="h-3 w-3" />
                        Generate Wildcard sslip.io
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. myapp.com, api.example.org, app.127.0.0.1.sslip.io"
                        value={customDomainInput}
                        onChange={(e) => setCustomDomainInput(e.target.value)}
                        required
                      />
                      <Button type="submit" isLoading={isSaving} variant="success" className="gap-1 font-bold whitespace-nowrap">
                        <Plus className="h-4 w-4" />
                        Add Domain
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="https-toggle"
                      checked={customHttps}
                      onChange={(e) => setCustomHttps(e.target.checked)}
                      className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                    />
                    <label htmlFor="https-toggle" className="text-xs text-slate-700 font-semibold cursor-pointer flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-emerald-600" />
                      Enable Automatic Let's Encrypt HTTPS / TLS SSL Certificate
                    </label>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 via-white to-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base font-bold">DNS Configuration Guide for Custom Domains</CardTitle>
                  </div>
                  <Button onClick={copyServerIp} size="sm" variant="outline" className="h-7 text-xs font-mono font-bold text-emerald-700 border-emerald-300">
                    {copiedIp ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copiedIp ? "IP Copied!" : `Server IP: ${serverIp}`}
                  </Button>
                </div>
                <CardDescription>
                  To connect your own domain name (from GoDaddy, Cloudflare, Namecheap), create these DNS records:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Host / Name</th>
                        <th className="p-2.5">Target / Value</th>
                        <th className="p-2.5">TTL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                      <tr>
                        <td className="p-2.5 font-bold text-emerald-600">A</td>
                        <td className="p-2.5">@ (or root)</td>
                        <td className="p-2.5 font-bold">{serverIp}</td>
                        <td className="p-2.5 text-slate-500">Auto / 300s</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-emerald-600">A</td>
                        <td className="p-2.5">* (wildcard subdomains)</td>
                        <td className="p-2.5 font-bold">{serverIp}</td>
                        <td className="p-2.5 text-slate-500">Auto / 300s</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-800">
                  Active Domain Routes ({domainsList.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {domainsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No custom domains added yet. Add your domain above.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {domainsList.map((d) => (
                      <div key={d.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-pink-600" />
                          <div>
                            <a
                              href={`http://${d.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono font-bold text-xs text-slate-900 hover:text-pink-600 flex items-center gap-1.5"
                            >
                              {d.domain}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="success" className="text-[10px]">
                                {d.https ? "SSL / HTTPS Active" : "HTTP Only"}
                              </Badge>
                              <span className="text-[10px] text-slate-400">Path: {d.pathPrefix}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleDeleteDomain(d.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Deployments & Webhooks Tab */}
        {activeTab === "deployments" && (
          <div className="space-y-6">
            <Card className="border-pink-200 bg-gradient-to-r from-pink-50/40 via-white to-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-pink-600" />
                    <CardTitle className="text-base font-bold">Auto-Deploy Engine & Webhooks</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Auto-Deploy:</span>
                    <button
                      type="button"
                      disabled={isTogglingAutoDeploy}
                      onClick={() => handleToggleAutoDeploy(!autoDeployEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        autoDeployEnabled ? "bg-pink-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoDeployEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <Badge variant={autoDeployEnabled ? "success" : "secondary"} className="text-[10px]">
                      {autoDeployEnabled ? "Active (Git Polling & Webhook)" : "Disabled"}
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  When enabled, Cowbox automatically watches your Git repository ({app.gitBranch || "main"} branch) and triggers zero-downtime rolling releases on every commit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Continuous Deployment Webhook URL</label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/deploy/${app.id}`}
                      className="font-mono text-xs bg-white text-slate-700"
                    />
                    <Button onClick={copyWebhookUrl} size="sm" variant="outline" className="gap-1.5 whitespace-nowrap text-pink-600 border-pink-200 hover:bg-pink-50 font-bold">
                      {copiedWebhook ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      {copiedWebhook ? "Copied!" : "Copy Webhook URL"}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Add this URL to your GitHub / GitLab / Gitea repository settings under <strong>Webhooks</strong> with <code>application/json</code> payload.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Activity className="h-4 w-4 text-pink-500" />
                    <span>Background Polling Daemon: <strong>Checks for new commits every 60s</strong></span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[11px] text-pink-700 border-pink-200">
                    Branch: {app.gitBranch || "main"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Deployment History ({app.deployments?.length || 0})
              </h3>

              {app.deployments?.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-slate-300 bg-white">
                  <Clock className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-800">No deployment history</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-3">
                    Click Deploy above to trigger your first release.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {app.deployments?.map((dep: any) => (
                    <Card key={dep.id} className="overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              dep.status === "running"
                                ? "success"
                                : dep.status === "building"
                                ? "warning"
                                : dep.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                            className="capitalize text-[11px]"
                          >
                            {dep.status}
                          </Badge>
                          <span className="text-sm font-bold text-slate-900">{dep.title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-500 font-mono font-semibold">
                            {dep.durationSeconds}s duration
                          </span>
                          {(dep.status === "running" || dep.status === "success") && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => confirmRollback(dep.id)}
                              className="h-7 text-xs font-bold gap-1.5"
                            >
                              ⏪ Rollback
                            </Button>
                          )}
                        </div>
                      </div>
                      {dep.logs && (
                        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-100 whitespace-pre-wrap max-h-60 overflow-y-auto terminal-scroll">
                          {dep.logs}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <Card className="overflow-hidden bg-slate-950 border-slate-800 shadow-md">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Terminal className="h-4 w-4 text-pink-400" />
                <span>stdout & stderr logs</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter logs (e.g. error, warn)..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="h-7 px-2.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none placeholder:text-slate-500 font-mono w-48"
                />
                <Button variant="ghost" size="sm" onClick={handleDownloadLogs} className="h-7 text-xs gap-1 text-slate-300 hover:text-white hover:bg-slate-800 font-medium">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </div>
            <div className="p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed terminal-scroll bg-black/60">
              {logSearch
                ? logs
                    .filter((l) => l.toLowerCase().includes(logSearch.toLowerCase()))
                    .join("\n") || `No log lines matching "${logSearch}"`
                : logs.join("\n")}
              <div ref={logsEndRef} />
            </div>
          </Card>
        )}

        {/* Environment Variables & DB Linking Tab */}
        {activeTab === "env" && (
          <div className="space-y-6">
            {projectDbs.length > 0 && (
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-emerald-600" />
                      <CardTitle className="text-base font-bold">1-Click Link Database</CardTitle>
                    </div>
                    <Badge variant="success" className="text-[11px]">
                      {projectDbs.length} DBs in Project
                    </Badge>
                  </div>
                  <CardDescription>
                    Automatically inject connection variables into this application.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2.5">
                    {projectDbs.map((db) => (
                      <Button
                        key={db.id}
                        type="button"
                        onClick={() => handleLinkDatabase(db)}
                        size="sm"
                        variant="outline"
                        className="gap-2 bg-white text-slate-800 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 font-semibold"
                      >
                        <Link2 className="h-4 w-4 text-emerald-600" />
                        Inject {db.name} ({db.type})
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Environment Variables</CardTitle>
                    <CardDescription>Define KEY=VAL variables injected into the container.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <input type="file" accept=".env" onChange={handleImportEnv} className="hidden" />
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1 font-semibold">
                        <Upload className="h-3.5 w-3.5" />
                        Import .env
                      </Button>
                    </label>
                    <Button type="button" onClick={handleExportEnv} variant="outline" size="sm" className="h-8 text-xs gap-1 font-semibold">
                      <Download className="h-3.5 w-3.5" />
                      Export .env
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  className="w-full h-64 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 leading-relaxed font-medium"
                  placeholder="NODE_ENV=production&#10;DATABASE_URL=postgresql://user:pass@cowbox-db-postgres:5432/main&#10;PORT=80"
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    Tip: Re-deploy the application after saving to apply changes.
                  </span>
                  <Button onClick={handleSaveEnv} isLoading={isSaving} size="sm" variant="success">
                    Save Environment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Resource Limits & Runtime</CardTitle>
              <CardDescription>Configure memory and CPU hardware constraints.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Memory Limit (e.g. 512m, 1g)</label>
                  <Input
                    placeholder="512m"
                    value={memoryLimit}
                    onChange={(e) => setMemoryLimit(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">CPU Limit (e.g. 0.5, 1.0)</label>
                  <Input
                    placeholder="1.0"
                    value={cpuLimit}
                    onChange={(e) => setCpuLimit(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Restart Policy</label>
                <select
                  className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 font-medium"
                  value={restartPolicy}
                  onChange={(e) => setRestartPolicy(e.target.value)}
                >
                  <option value="unless-stopped">Unless Stopped (Recommended)</option>
                  <option value="always">Always</option>
                  <option value="on-failure">On Failure</option>
                  <option value="no">Never</option>
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveSettings} isLoading={isSaving} size="sm" variant="success">
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Live Deployment Screen Modal */}
      <Modal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        title={`Live Deployment Screen: ${app.name}`}
        description="Real-time build pipeline and container activation stream"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { num: 1, label: "Workspace" },
              { num: 2, label: "Dependencies" },
              { num: 3, label: "Container" },
              { num: 4, label: "SSL Routing" },
            ].map((st) => {
              const isDone = deployStep > st.num || deploySuccess;
              const isCurrent = deployStep === st.num && !deploySuccess;
              return (
                <div
                  key={st.num}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isDone
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                      : isCurrent
                      ? "bg-pink-50 border-pink-300 text-pink-700 font-bold animate-pulse"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 text-pink-600 animate-spin" />
                    ) : (
                      <span className="font-mono">{st.num}</span>
                    )}
                    <span>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs max-h-64 overflow-y-auto leading-relaxed terminal-scroll text-emerald-400 space-y-1 shadow-inner">
            {deployLogs.map((l, i) => (
              <div key={i} className={l.includes("ERROR") ? "text-rose-400 font-bold" : l.includes("SUCCESS") ? "text-emerald-300 font-bold" : ""}>
                {l}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Elapsed: {deployDuration}s
            </div>

            <div className="flex items-center gap-2">
              {deploySuccess && (
                <a
                  href={`http://${primaryDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-md shadow-emerald-500/20 transition-all"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Open Live App
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <Button onClick={() => setIsDeployModalOpen(false)} size="sm" variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Rollback Confirmation Modal */}
      <Modal
        isOpen={isRollbackModalOpen}
        onClose={() => setIsRollbackModalOpen(false)}
        title="Confirm Rollback"
        description="Are you sure you want to rollback to this exact deployment? This will stop the current container..."
      >
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => setIsRollbackModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={executeRollback} isLoading={isRollingBack}>
            Confirm Rollback
          </Button>
        </div>
      </Modal>
    </div>
  );
}
