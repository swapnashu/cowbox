"use client";

import { useState, useEffect } from "react";
import { Activity, Plus, Trash2, Globe, Server, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export default function ManageStatusPage() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newMonitor, setNewMonitor] = useState({ name: "", type: "http", target: "" });

  const loadMonitors = async () => {
    try {
      const res = await fetch("/api/status/monitors");
      if (res.ok) {
        const data = await res.json();
        setMonitors(data.monitors || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitors();
  }, []);

  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/status/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMonitor),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewMonitor({ name: "", type: "http", target: "" });
        loadMonitors();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this monitor?")) return;
    try {
      const res = await fetch(`/api/status/monitors/${id}`, { method: "DELETE" });
      if (res.ok) loadMonitors();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading monitors...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-pink-600" />
            Status Monitors
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage public status page monitors and incidents</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold">
          <Plus className="h-4 w-4" />
          Add Monitor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Monitors</CardTitle>
          <CardDescription>Checks run automatically every minute to verify uptime.</CardDescription>
        </CardHeader>
        <CardContent>
          {monitors.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No monitors configured yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {monitors.map((m) => (
                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    {m.type === "http" ? <Globe className="h-5 w-5 text-blue-500" /> :
                     m.type === "tcp" ? <Server className="h-5 w-5 text-amber-500" /> :
                     <Layers className="h-5 w-5 text-pink-500" />}
                    <div>
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{m.target}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={m.status === "up" ? "success" : "destructive"} className="uppercase text-[10px]">
                      {m.status || "pending"}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Monitor">
        <form onSubmit={handleAddMonitor} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Monitor Name</label>
            <Input required value={newMonitor.name} onChange={(e) => setNewMonitor({ ...newMonitor, name: e.target.value })} placeholder="e.g. Main Website" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Type</label>
            <select className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm" value={newMonitor.type} onChange={(e) => setNewMonitor({ ...newMonitor, type: e.target.value })}>
              <option value="http">HTTP/HTTPS</option>
              <option value="tcp">TCP Port</option>
              <option value="container">Docker Container</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Target</label>
            <Input required value={newMonitor.target} onChange={(e) => setNewMonitor({ ...newMonitor, target: e.target.value })} placeholder="e.g. https://example.com" />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="success" isLoading={isSaving}>Save Monitor</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
