"use client";

import { useState, useEffect } from "react";
import {
  Server,
  ShieldCheck,
  RotateCw,
  Play,
  HardDrive,
  Cpu,
  Globe,
  ExternalLink,
  Activity,
  Terminal,
  Layers,
  Lock,
  Zap,
  Sparkles,
  Database,
  Trash2,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/utils";

export default function ServerSettingsPage() {
  const [stats, setStats] = useState<any>(null);
  const [storageData, setStorageData] = useState<any>(null);
  const [doctorData, setDoctorData] = useState<any>(null);
  const [letsEncryptEmail, setLetsEncryptEmail] = useState("");
  const [isInitializingTraefik, setIsInitializingTraefik] = useState(false);
  const [traefikMessage, setTraefikMessage] = useState<string | null>(null);
  const [isHealing, setIsHealing] = useState(false);
  const [doctorMessage, setDoctorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const [statusRes, storageRes, docRes] = await Promise.all([
        fetch("/api/server/status"),
        fetch("/api/docker/storage"),
        fetch("/api/server/doctor"),
      ]);
      if (statusRes.ok) setStats(await statusRes.json());
      if (storageRes.ok) setStorageData(await storageRes.json());
      if (docRes.ok) setDoctorData(await docRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRunDoctorHealing = async () => {
    setIsHealing(true);
    setDoctorMessage(null);
    try {
      const res = await fetch("/api/server/doctor", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setDoctorMessage(data.message);
        fetchStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsHealing(false);
    }
  };

  const handleConfigureTraefik = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInitializingTraefik(true);
    setTraefikMessage(null);
    try {
      const res = await fetch("/api/server/traefik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letsEncryptEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setTraefikMessage(data.message || "Traefik proxy initialized successfully!");
        fetchStatus();
      } else {
        setTraefikMessage(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setTraefikMessage(`Error: ${e.message}`);
    } finally {
      setIsInitializingTraefik(false);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return "0s";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? `${d}d ` : ""}${h}h ${m}m`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Server className="h-6 w-6 text-pink-600" />
            Server Full Specs & Infrastructure Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Host system telemetry, Docker Engine runtime metrics, Traefik reverse proxy & wildcard SSL configuration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRunDoctorHealing} isLoading={isHealing} size="sm" variant="success" className="gap-1.5 font-bold shadow-md shadow-emerald-500/20">
            <Stethoscope className="h-4 w-4" />
            1-Click System Doctor & Auto-Heal
          </Button>
          <Button onClick={fetchStatus} variant="outline" size="sm" className="gap-1.5 font-semibold text-slate-700">
            <RotateCw className="h-4 w-4 text-pink-500" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Doctor Message Toast */}
      {doctorMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{doctorMessage}</span>
        </div>
      )}

      {/* Host Node Full Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:border-pink-300 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Host Node</span>
              <Server className="h-4 w-4 text-pink-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold text-slate-900 truncate">
              {stats?.system?.hostname || "Local Node"}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">
              {stats?.system?.platform} ({stats?.system?.arch})
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-emerald-300 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>CPU Processor</span>
              <Cpu className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold text-emerald-600">
              {stats?.system?.cpuCount || 0} Cores
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate" title={stats?.system?.cpuModel}>
              {stats?.system?.cpuModel || "Processor"}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-pink-300 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Memory Usage</span>
              <HardDrive className="h-4 w-4 text-pink-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold text-slate-900">
              {stats?.system?.memory?.percent || 0}%
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {stats?.system?.memory ? `${formatBytes(stats.system.memory.used)} / ${formatBytes(stats.system.memory.total)}` : "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-emerald-300 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Uptime</span>
              <Activity className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold text-emerald-600 font-mono">
              {formatUptime(stats?.system?.uptime)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Continuous node uptime</p>
          </CardContent>
        </Card>
      </div>

      {/* System Doctor Diagnostic Check List */}
      {doctorData && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/40 via-white to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Stethoscope className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">System Health Doctor & Self-Healing Diagnostics</CardTitle>
              </div>
              <Badge variant={doctorData.healthy ? "success" : "warning"}>
                {doctorData.healthy ? "All Systems Optimal" : "Optimization Recommended"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {doctorData.checks?.map((chk: any) => (
                <div key={chk.name} className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-2.5 shadow-sm">
                  {chk.status === "pass" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold text-slate-800 block">{chk.name}</span>
                    <span className="text-slate-500 mt-0.5 block">{chk.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Traefik Reverse Proxy & SSL Configuration */}
      <Card className="border-pink-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Traefik Reverse Proxy & ACME Let's Encrypt</CardTitle>
                <CardDescription>
                  Dynamic subdomain routing, automatic SSL/TLS certificate issuing, and port forwarder.
                </CardDescription>
              </div>
            </div>
            <Badge variant={stats?.traefikRunning ? "success" : "secondary"}>
              {stats?.traefikRunning ? "Proxy Running" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {traefikMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
              {traefikMessage}
            </div>
          )}

          <form onSubmit={handleConfigureTraefik} className="space-y-4">
            <div className="space-y-1.5 max-w-md">
              <label className="text-xs font-semibold text-slate-700">
                Let's Encrypt ACME Email (For SSL Certificates)
              </label>
              <Input
                type="email"
                placeholder="admin@yourdomain.com"
                value={letsEncryptEmail}
                onChange={(e) => setLetsEncryptEmail(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={isInitializingTraefik} variant="success" className="gap-2 shadow-md shadow-emerald-500/20 font-bold">
                <Play className="h-4 w-4" />
                {stats?.traefikRunning ? "Restart / Update Traefik" : "Start Traefik Proxy"}
              </Button>

              {stats?.traefikRunning && (
                <a
                  href="http://localhost:8080"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-pink-600 hover:underline flex items-center gap-1 font-bold"
                >
                  Open Traefik Dashboard (Port 8080)
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-medium block">HTTP Ingress Port</span>
              <span className="font-mono text-slate-800 font-bold mt-0.5 block">80</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-medium block">HTTPS / TLS Port</span>
              <span className="font-mono text-slate-800 font-bold mt-0.5 block">443</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-medium block">Docker Network</span>
              <span className="font-mono text-slate-800 font-bold mt-0.5 block">cowbox-network</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Docker Storage & Volumes Inspector */}
      {storageData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Volumes Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-amber-500" />
                Docker Persistent Storage Volumes ({storageData.volumes?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {storageData.volumes?.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No volumes found</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
                  {storageData.volumes?.map((v: any) => (
                    <div key={v.name} className="py-2.5 flex justify-between items-center">
                      <span className="font-mono font-bold text-slate-800 truncate max-w-[200px]">{v.name}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{v.driver}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Images Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-600" />
                Cached Docker Images ({storageData.images?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {storageData.images?.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No images cached</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
                  {storageData.images?.map((img: any) => (
                    <div key={img.id} className="py-2.5 flex justify-between items-center">
                      <span className="font-mono font-bold text-slate-800 truncate max-w-[200px]">{img.tags[0]}</span>
                      <span className="font-mono text-[11px] text-slate-500">{formatBytes(img.sizeBytes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
