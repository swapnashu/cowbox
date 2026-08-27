"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Play,
  Trash2,
  Plus,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Globe,
  HardDrive,
  Activity,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export default function CronJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("0 0 * * *");
  const [targetType, setTargetType] = useState<"shell" | "http" | "backup">("shell");
  const [command, setCommand] = useState("");
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/cron");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !schedule.trim() || !command.trim()) return;

    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, schedule, targetType, command }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setName("");
        setCommand("");
        fetchJobs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunJobNow = async (id: string) => {
    setRunningJobId(id);
    try {
      await fetch(`/api/cron/${id}/run`, { method: "POST" });
      await fetchJobs();
    } catch (e) {
      console.error(e);
    } finally {
      setRunningJobId(null);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm("Are you sure you want to delete this scheduled cron task?")) return;
    try {
      await fetch(`/api/cron/${id}/run`, { method: "DELETE" });
      fetchJobs();
    } catch (e) {}
  };

  const handleApplyPreset = (presetName: string, sched: string, type: "shell" | "http", cmd: string) => {
    setName(presetName);
    setSchedule(sched);
    setTargetType(type);
    setCommand(cmd);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-pink-600" />
            Scheduled Cron Jobs & Background Tasks
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automate recurring maintenance, database snapshot backups, webhook triggers, and cleanup routines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsModalOpen(true)}
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-md shadow-pink-500/20"
          >
            <Plus className="h-4 w-4" />
            New Cron Job
          </Button>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
        <span className="font-bold text-slate-700 flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-pink-500" />
          Quick Automation Presets:
        </span>
        <button
          onClick={() => handleApplyPreset("Daily Midnight DB Backup", "0 0 * * *", "shell", "curl -X POST http://localhost:9999/api/databases/backup-all")}
          className="px-2.5 py-1 bg-white hover:bg-pink-50 hover:text-pink-600 rounded-lg border border-slate-200 font-semibold transition-colors shadow-sm"
        >
          + Nightly Backups (0 0 * * *)
        </button>
        <button
          onClick={() => handleApplyPreset("Health Ping Every 5 Mins", "*/5 * * * *", "http", "http://localhost:9999/api/server/status")}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-lg border border-slate-200 font-semibold transition-colors shadow-sm"
        >
          + Uptime Ping (*/5 * * * *)
        </button>
        <button
          onClick={() => handleApplyPreset("Weekly Docker Storage Cleanup", "0 3 * * 0", "shell", "curl -X POST http://localhost:9999/api/containers/prune")}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 font-semibold transition-colors shadow-sm"
        >
          + Weekly Prune (Sunday 3AM)
        </button>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading scheduled jobs...</div>
        ) : jobs.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-slate-300 bg-white">
            <Clock className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No scheduled cron jobs</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Schedule recurring backup scripts, automated pings, or cleanup commands.
            </p>
            <Button onClick={() => setIsModalOpen(true)} size="sm" variant="success" className="font-bold">
              <Plus className="h-4 w-4 mr-1" />
              Create First Cron Job
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {jobs.map((j) => (
              <Card key={j.id} className="overflow-hidden hover:border-pink-300 transition-all">
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200 mt-0.5">
                      {j.targetType === "http" ? (
                        <Globe className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Terminal className="h-5 w-5 text-pink-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{j.name}</span>
                        <Badge
                          variant={j.lastStatus === "success" ? "success" : j.lastStatus === "failed" ? "destructive" : "secondary"}
                          className="text-[10px] capitalize font-bold"
                        >
                          {j.lastStatus}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                        <span>Schedule: <strong className="text-pink-600">{j.schedule}</strong></span>
                        <span>Type: {j.targetType}</span>
                        <span>Last Run: {j.lastRun ? new Date(j.lastRun).toLocaleString() : "Never"}</span>
                      </div>

                      <div className="text-xs font-mono bg-slate-50 p-2 rounded-lg border border-slate-200 mt-2 text-slate-800 break-all">
                        {j.command}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      onClick={() => handleRunJobNow(j.id)}
                      isLoading={runningJobId === j.id}
                      size="sm"
                      variant="success"
                      className="gap-1 text-xs font-bold shadow-sm shadow-emerald-500/20"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Run Now
                    </Button>
                    <Button
                      onClick={() => handleDeleteJob(j.id)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {j.logs && (
                  <div className="p-3 bg-slate-950 font-mono text-[11px] text-slate-300 border-t border-slate-800 max-h-24 overflow-y-auto terminal-scroll">
                    {j.logs}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New Cron Job Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule New Cron Task"
        description="Configure periodic background execution with cron expression"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Task Name *</label>
            <Input
              placeholder="e.g. Nightly Database Dump, Sync Data"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Execution Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("shell")}
                className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                  targetType === "shell"
                    ? "bg-pink-50 border-pink-300 text-pink-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600"
                }`}
              >
                Shell Script Command
              </button>
              <button
                type="button"
                onClick={() => setTargetType("http")}
                className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                  targetType === "http"
                    ? "bg-pink-50 border-pink-300 text-pink-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600"
                }`}
              >
                HTTP Webhook Ping
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Cron Schedule Expression *</label>
            <Input
              placeholder="0 0 * * * (Every midnight) or */15 * * * *"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {targetType === "http" ? "Target Webhook URL *" : "Command Line String *"}
            </label>
            <Input
              placeholder={targetType === "http" ? "https://api.example.com/health" : "node script.js or curl http://..."}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="font-mono text-xs"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" className="font-bold">
              Schedule Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
