"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Search,
  Server,
  Sparkles,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  HardDrive,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
export function Navbar() {
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/server/status");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const serverIp = stats?.serverIp || "127.0.0.1";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      {/* Search Bar / Quick Finder */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-pink-500 transition-colors" />
          <input
            id="global-search"
            type="text"
            placeholder="Search projects, apps, databases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-12 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-medium placeholder:text-slate-400 text-slate-900"
          />
          <div className="absolute right-2 top-2 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-mono text-slate-400 pointer-events-none">
            ⌘K
          </div>
        </div>
      </div>

      {/* Right Telemetry & Actions Bar */}
      <div className="flex items-center gap-3">
        {/* Node IP & sslip.io Badge */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-50  px-3 py-1.5 rounded-xl border border-slate-200  text-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-mono text-slate-700  font-bold">{serverIp}</span>
          <span className="text-[10px] text-pink-600  font-bold bg-pink-50  px-1.5 py-0.5 rounded border border-pink-200 ">
            sslip.io
          </span>
        </div>

        {/* Live RAM Indicator */}
        {stats?.system?.memory && (
          <div className="hidden md:flex items-center gap-2 bg-slate-50  px-3 py-1.5 rounded-xl border border-slate-200  text-xs">
            <HardDrive className="h-3.5 w-3.5 text-pink-500" />
            <span className="text-slate-600  font-medium">
              RAM: <strong className="text-slate-800  font-bold">{stats.system.memory.percent}%</strong>
            </span>
          </div>
        )}

        {/* Traefik Status */}
        <div className="flex items-center gap-1.5 bg-emerald-50  px-2.5 py-1.5 rounded-xl border border-emerald-200  text-xs text-emerald-800  font-bold">
          <ShieldCheck className="h-4 w-4 text-emerald-600 " />
          <span className="hidden sm:inline">Traefik SSL</span>
        </div>

        {/* Templates Quick Launch */}
        <Link href="/templates">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-bold text-pink-600  border-pink-200  hover:bg-pink-50 :bg-pink-900/20 ">
            <Sparkles className="h-3.5 w-3.5" />
            Templates
          </Button>
        </Link>
      </div>
    </header>
  );
}
