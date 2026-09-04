"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Database,
  Server,
  Layers,
  Sparkles,
  ArrowRight,
  Plus,
  Play,
  Cpu,
  HardDrive,
  Activity,
  ShieldCheck,
  Globe,
  Zap,
  FolderCode,
  RotateCw,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { SparklineChart } from "@/components/ui/sparkline-chart";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestartingAll, setIsRestartingAll] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [serverRes, projectsRes, metricsRes] = await Promise.all([
        fetch("/api/server/status"),
        fetch("/api/projects"),
        fetch("/api/monitoring")
      ]);

      if (serverRes.ok) setStats(await serverRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (metricsRes.ok) setMetricsHistory(await metricsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const intervalId = setInterval(async () => {
      try {
        await fetch("/api/monitoring/collect", { method: "POST" });
        loadData();
      } catch (e) {}
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const handleRestartAll = async () => {
    if (!confirm("Restart all running containers on this server?")) return;
    setIsRestartingAll(true);
    try {
      const res = await fetch("/api/containers/restart-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBannerMessage(data.message || "All containers restarted.");
        setTimeout(() => setBannerMessage(null), 3000);
        loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRestartingAll(false);
    }
  };

  const totalApps = projects.reduce((acc, p) => acc + (p.applicationsCount || 0), 0);
  const totalDbs = projects.reduce((acc, p) => acc + (p.databasesCount || 0), 0);
  const runningApps = projects.reduce((acc, p) => acc + (p.runningAppsCount || 0), 0);
  const serverIp = stats?.serverIp || "127.0.0.1";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Cowbox Cluster Active • Port 9999 • Wildcard sslip.io Enabled
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Dashboard Overview
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Orchestrate multiple projects, apps, databases, and custom domains with zero-config SSL.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleRestartAll}
            isLoading={isRestartingAll}
            variant="outline"
            size="sm"
            className="gap-1.5 font-bold text-slate-700 hover:text-pink-600"
          >
            <RotateCw className="h-4 w-4 text-pink-500" />
            Restart Dockers
          </Button>

          <Link href="/projects">
            <Button size="sm" className="gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20 font-bold">
              <Plus className="h-4 w-4" />
              New Project / Deploy
            </Button>
          </Link>
        </div>
      </div>

      {/* Notification Toast */}
      {bannerMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {bannerMessage}
        </div>
      )}

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/projects" className="group">
          <Card className="p-4 hover:border-pink-400 hover:shadow-md transition-all bg-gradient-to-tr from-pink-50/40 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-pink-100/70 text-pink-600 group-hover:scale-105 transition-transform">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block group-hover:text-pink-600 transition-colors">Deploy Application</span>
                <span className="text-[11px] text-slate-500">Git, Image, ZIP Upload</span>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/databases" className="group">
          <Card className="p-4 hover:border-amber-400 hover:shadow-md transition-all bg-gradient-to-tr from-amber-50/40 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100/70 text-amber-600 group-hover:scale-105 transition-transform">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block group-hover:text-amber-600 transition-colors">Managed Databases</span>
                <span className="text-[11px] text-slate-500">Postgres, MySQL, Redis</span>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/files" className="group">
          <Card className="p-4 hover:border-blue-400 hover:shadow-md transition-all bg-gradient-to-tr from-blue-50/40 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100/70 text-blue-600 group-hover:scale-105 transition-transform">
                <FolderCode className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block group-hover:text-blue-600 transition-colors">File Manager & Runner</span>
                <span className="text-[11px] text-slate-500">Edit, Create, Run Code</span>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/docker" className="group">
          <Card className="p-4 hover:border-emerald-400 hover:shadow-md transition-all bg-gradient-to-tr from-emerald-50/40 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 group-hover:scale-105 transition-transform">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block group-hover:text-emerald-600 transition-colors">Docker Management Hub</span>
                <span className="text-[11px] text-slate-500">Containers, Images, Volumes</span>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Projects Card */}
        <Card className="hover:border-pink-300 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Multi-Projects</CardTitle>
            <div className="p-2 rounded-lg bg-pink-50 text-pink-500 border border-pink-100">
              <FolderKanban className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{projects.length}</div>
            <p className="text-xs text-slate-500 mt-1">Isolated project environments</p>
          </CardContent>
        </Card>

        {/* Applications Card */}
        <Card className="hover:border-emerald-300 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Active Apps</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">
              {runningApps} <span className="text-sm font-medium text-slate-400">/ {totalApps}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Running containers</p>
          </CardContent>
        </Card>

        {/* Databases Card */}
        <Card className="hover:border-pink-300 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Databases</CardTitle>
            <div className="p-2 rounded-lg bg-pink-50 text-pink-500 border border-pink-100">
              <Database className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">{totalDbs}</div>
            <p className="text-xs text-slate-500 mt-1">Managed DB containers</p>
          </CardContent>
        </Card>

        {/* Docker Engine Card */}
        <Card className="hover:border-emerald-300 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Docker Daemon</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Server className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">
              {stats?.connected ? "Online" : "Connecting..."}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              {stats?.version ? `Docker v${stats.version}` : "Local Pipe/Socket"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Hardware Telemetry Bar */}
      {stats?.system && (
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold text-slate-800">Live Hardware Telemetry</CardTitle>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono text-slate-600">
                Host: {stats.system.hostname} ({stats.system.platform})
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>CPU Processor</span>
                <span className="text-emerald-600 font-bold">{stats.system.cpuCount} Cores</span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">{stats.system.cpuModel}</p>
              <div className="mt-2 h-10">
                <SparklineChart data={metricsHistory.map(m => m.cpuPercent || 0)} color="#10b981" height={40} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Memory (RAM)</span>
                <span className="text-pink-600 font-bold">{stats.system.memory.percent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full transition-all"
                  style={{ width: `${stats.system.memory.percent}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>Used: {formatBytes(stats.system.memory.used)}</span>
                <span>Total: {formatBytes(stats.system.memory.total)}</span>
              </div>
              <div className="mt-2 h-10">
                <SparklineChart data={metricsHistory.map(m => m.memoryPercent || 0)} color="#ec4899" height={40} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Traefik Proxy & TLS</span>
                <span className="text-emerald-600 font-bold">{stats.traefikRunning ? "Running" : "Ready"}</span>
              </div>
              <p className="text-[11px] text-slate-500">Auto ACME Let's Encrypt</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Your Projects & Deployments</h2>
          <Link href="/projects" className="text-xs font-bold text-pink-600 hover:underline flex items-center gap-1">
            View All Projects
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading projects...</div>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-slate-300 bg-white">
            <div className="h-12 w-12 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mx-auto mb-3 border border-pink-100">
              <FolderKanban className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No projects found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Get started by creating your first project.
            </p>
            <Link href="/projects">
              <Button size="sm" className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold">
                <Plus className="h-4 w-4 mr-1" />
                Create First Project
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="group">
                <Card className="h-full hover:border-pink-300 hover:shadow-md transition-all flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-pink-50 text-pink-600 border border-pink-200 group-hover:scale-105 transition-transform">
                          <FolderKanban className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold group-hover:text-pink-600 transition-colors">
                            {project.name}
                          </CardTitle>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                            ID: {project.id.substring(0, 8)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {project.description && (
                      <CardDescription className="line-clamp-2 mt-2 text-xs">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50 p-4">
                    <div className="flex items-center gap-3 font-semibold">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <Layers className="h-3.5 w-3.5" />
                        {project.applicationsCount || 0} Apps
                      </span>
                      <span className="flex items-center gap-1 text-pink-700">
                        <Database className="h-3.5 w-3.5" />
                        {project.databasesCount || 0} DBs
                      </span>
                    </div>

                    <span className="text-pink-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Open →
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-600" />
            Recent Activity
          </h2>
        </div>
        
        <Card className="bg-white">
          <ActivityFeed />
        </Card>
      </div>
    </div>
  );
}

function ActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activity")
      .then(res => res.json())
      .then(data => setActivities(data.activities || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading activity...</div>;
  if (activities.length === 0) return (
    <div className="p-12 text-center flex flex-col items-center justify-center">
      <div className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-100">
        <Activity className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-800">No recent activity</h3>
      <p className="text-xs text-slate-500 mt-1">Actions like deployments will appear here.</p>
    </div>
  );

  return (
    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
      {activities.slice(0, 15).map((activity, i) => (
        <div key={i} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${
              activity.status === "success" ? "bg-emerald-500" :
              activity.status === "failed" ? "bg-red-500" :
              activity.status === "warning" ? "bg-amber-500" :
              "bg-blue-500"
            }`}></span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
              {activity.type === "deployment" ? <Play className="h-4 w-4" /> :
               activity.type === "restart" ? <RotateCw className="h-4 w-4" /> :
               <ShieldCheck className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{activity.description}</p>
              <span className="text-xs text-slate-500">{activity.timeAgo || "Just now"}</span>
            </div>
          </div>
          <div className="ml-auto">
            <Badge variant={
              activity.status === "success" ? "success" :
              activity.status === "failed" ? "destructive" :
              activity.status === "warning" ? "warning" : "default"
            } className="text-[10px] capitalize">
              {activity.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
