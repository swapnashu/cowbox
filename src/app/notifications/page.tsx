"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Plus,
  Trash2,
  Send,
  MessageSquare,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export default function NotificationsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Form State
  const [type, setType] = useState<string>("discord");
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [events, setEvents] = useState({
    "deploy:success": true,
    "deploy:failed": true,
    "container:stopped": false,
    "cron:failed": true,
  });

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load channels", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreate = async () => {
    if (!name || !webhookUrl) {
      toast({ title: "Name and Webhook URL are required", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedEvents = Object.entries(events)
        .filter(([_, enabled]) => enabled)
        .map(([event]) => event);

      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, webhookUrl, events: selectedEvents }),
      });

      if (res.ok) {
        toast({ title: "Channel created successfully", variant: "success" });
        setIsModalOpen(false);
        setName("");
        setWebhookUrl("");
        fetchChannels();
      } else {
        toast({ title: "Failed to create channel", variant: "error" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "An unexpected error occurred", variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this notification channel?")) return;
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Channel deleted", variant: "success" });
        fetchChannels();
      } else {
        toast({ title: "Failed to delete channel", variant: "error" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error deleting channel", variant: "error" });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Test message sent!", variant: "success" });
      } else {
        toast({ title: "Failed to send test message", variant: "error" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error sending test message", variant: "error" });
    }
  };

  const channelTypes = [
    { id: "discord", name: "Discord", color: "bg-indigo-500", border: "border-indigo-500" },
    { id: "telegram", name: "Telegram", color: "bg-sky-500", border: "border-sky-500" },
    { id: "slack", name: "Slack", color: "bg-emerald-500", border: "border-emerald-500" },
    { id: "webhook", name: "Webhook", color: "bg-slate-600", border: "border-slate-600" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-pink-600" />
            Notification Channels
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure webhooks to receive alerts for deployments, container events, and cron jobs.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5 font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20"
        >
          <Plus className="h-4 w-4" />
          Add Channel
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading channels...</div>
      ) : channels.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white">
          <div className="h-12 w-12 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mx-auto mb-3 border border-pink-100">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No notification channels configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Stay updated by connecting Discord, Telegram, or Slack webhooks to receive real-time alerts.
          </p>
          <Button onClick={() => setIsModalOpen(true)} size="sm" className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold">
            <Plus className="h-4 w-4 mr-1" />
            Add First Channel
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((channel) => {
            const chType = channelTypes.find((t) => t.id === channel.type) || channelTypes[3];
            return (
              <Card key={channel.id} className="hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white ${chType.color}`}>
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">{channel.name}</CardTitle>
                        <span className="text-xs font-semibold text-slate-500 capitalize">{channel.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {channel.enabled ? (
                        <Badge variant="success" className="text-[10px]">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 border-t border-slate-100 text-sm space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {channel.events?.map((evt: string) => (
                      <Badge key={evt} variant="outline" className="text-[10px] bg-slate-50">
                        {evt}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 font-mono truncate">
                    {channel.webhookUrl.replace(/^https?:\/\/[^\/]+/, '***')}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      onClick={() => handleTest(channel.id)}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-bold gap-1 text-slate-600"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send Test
                    </Button>
                    <Button
                      onClick={() => handleDelete(channel.id)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Notification Channel"
        description="Configure a new webhook to receive cluster alerts"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Channel Type</label>
            <div className="grid grid-cols-2 gap-2">
              {channelTypes.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-2 ${
                    type === t.id ? `${t.border} bg-slate-50` : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white ${t.color}`}>
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>
                  <span className={`text-sm font-bold ${type === t.id ? "text-slate-900" : "text-slate-600"}`}>
                    {t.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Channel Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Alerts"
              className="bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Webhook URL</label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://..."
              className="bg-slate-50 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Subscribed Events</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(events).map(([evt, enabled]) => (
                <label key={evt} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEvents({ ...events, [evt]: e.target.checked })}
                    className="rounded text-pink-500 focus:ring-pink-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">{evt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={isSubmitting}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold"
            >
              Save Channel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
