"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  Database,
  Layers,
  Sparkles,
  Zap,
  FolderCode,
  Clock,
  Key,
  Server,
  RotateCw,
  Plus,
  Trash2,
  Terminal,
  ShieldCheck,
} from "lucide-react";
import { COWBOX_VERSION } from "@/lib/version";

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/projects")
        .then((res) => res.json())
        .then((data) => setProjects(data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickActions = [
    { name: "Dashboard Overview", href: "/", icon: LayoutDashboard, category: "Navigation" },
    { name: "Projects & Applications", href: "/projects", icon: FolderKanban, category: "Navigation" },
    { name: "File Manager & Code Runner", href: "/files", icon: FolderCode, category: "Navigation" },
    { name: "Managed Databases", href: "/databases", icon: Database, category: "Navigation" },
    { name: "Running Services & Containers", href: "/services", icon: Layers, category: "Navigation" },
    { name: "Docker Compose Stacks", href: "/compose", icon: Sparkles, category: "Navigation" },
    { name: "Cron Automation Hub", href: "/cron", icon: Clock, category: "Navigation" },
    { name: "1-Click App Templates", href: "/templates", icon: Zap, category: "Navigation" },
    { name: "API Keys & Security Hub", href: "/api-keys", icon: Key, category: "Navigation" },
    { name: "Server Full Telemetry", href: "/servers", icon: Server, category: "Navigation" },
  ];

  const filteredActions = quickActions.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setSearch("");
    router.push(href);
  };

  const handleRestartAll = async () => {
    setIsOpen(false);
    await fetch("/api/containers/restart-all", { method: "POST" });
    router.push("/services");
  };

  const handlePruneStorage = async () => {
    setIsOpen(false);
    await fetch("/api/containers/prune", { method: "POST" });
    router.push("/servers");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-3">
          <Search className="h-5 w-5 text-pink-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Type a command or jump to page (Esc to close)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 terminal-scroll">
          {/* Quick Operations */}
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Quick Actions
          </div>
          <button
            onClick={handleRestartAll}
            className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between text-slate-700 hover:bg-pink-50 hover:text-pink-600 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <RotateCw className="h-4 w-4 text-pink-500" />
              <span>Restart All Containers</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">1-Click</span>
          </button>
          <button
            onClick={handlePruneStorage}
            className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="h-4 w-4 text-emerald-600" />
              <span>Prune Unused Docker Storage</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Free Space</span>
          </button>

          {/* Navigation Pages */}
          <div className="px-2 pt-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Pages & Tools
          </div>
          {filteredActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.name}
                onClick={() => handleSelect(action.href)}
                className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span>{action.name}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{action.category}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between font-medium">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px]">
                Ctrl+K
              </kbd>{" "}
              Spotlight
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px]">
                Ctrl+S
              </kbd>{" "}
              Save File
            </span>
          </div>
          <span className="text-pink-600 font-bold">Cowbox v{COWBOX_VERSION}</span>
        </div>
      </div>
    </div>
  );
}
