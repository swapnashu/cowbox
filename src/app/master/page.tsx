"use client";

import { useEffect, useState } from "react";
import {
  Cpu,
  Server,
  Activity,
  MemoryStick,
  Play,
  Square,
  RotateCw,
  Search,
  HardDrive
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function MasterPanelPage() {
  const [status, setStatus] = useState<any>(null);
  const [containers, setContainers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    try {
      const [statusRes, containersRes] = await Promise.all([
        fetch("/api/server/status"),
        fetch("/api/containers")
      ]);
      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
      if (containersRes.ok) {
        const cData = await containersRes.json();
        setContainers(cData.containers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
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
