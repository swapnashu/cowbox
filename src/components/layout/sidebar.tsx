"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Database,
  Layers,
  Server,
  Cpu,
  Sparkles,
  Zap,
  FolderCode,
  Clock,
  Key,
  ShieldCheck,
  Bell,
  Activity,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationGroups = [
  {
    label: "Core",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Projects & Apps", href: "/projects", icon: FolderKanban },
      { name: "Databases", href: "/databases", icon: Database },
      { name: "Compose Stacks", href: "/compose", icon: Sparkles },
    ],
  },
  {
    label: "Tools",
    items: [
      { name: "Docker Hub", href: "/docker", icon: Layers },
      { name: "Master Panel", href: "/master", icon: Cpu },
      { name: "App Store", href: "/templates", icon: Zap },
      { name: "File Manager", href: "/files", icon: FolderCode },
      { name: "Cron Automation", href: "/cron", icon: Clock },
      { name: "Running Services", href: "/services", icon: Activity },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Server Specs", href: "/servers", icon: Server },
      { name: "API Docs", href: "/docs", icon: Terminal },
      { name: "API Keys", href: "/api-keys", icon: Key },
      { name: "Notifications", href: "/notifications", icon: Bell },
      { name: "Status Monitors", href: "/status/manage", icon: Activity },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200/90  bg-white  flex flex-col justify-between h-screen sticky top-0 shadow-sm z-30">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-100 ">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-emerald-400 flex items-center justify-center shadow-md shadow-pink-500/20 text-white font-black text-base">
            🐮
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-pink-600 via-rose-600 to-emerald-600    bg-clip-text text-transparent">
                Cowbox
              </span>
            </div>
            <span className="text-[10px] text-emerald-600  font-semibold block uppercase tracking-wider">
              Self-Hosted PaaS
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-4">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150",
                        isActive
                          ? "bg-gradient-to-r from-pink-50 to-rose-50/50 text-pink-600 font-bold border border-pink-200/70 shadow-sm"
                          : "text-slate-600 hover:text-pink-600 hover:bg-pink-50/40"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-pink-500" : "text-slate-400")} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer System Status Badge */}
      <div className="p-4 border-t border-slate-100  bg-slate-50/50 ">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white  border border-slate-200/80  text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-slate-800  font-semibold">Cowbox Cluster</span>
          </div>
          <span className="text-[11px] text-emerald-600  font-mono font-medium bg-emerald-50  px-2 py-0.5 rounded-md border border-emerald-200 ">
            v0.1.0
          </span>
        </div>
      </div>
    </aside>
  );
}
