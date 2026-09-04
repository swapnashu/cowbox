"use client";

import { useMemo } from "react";
import YAML from "yaml";
import {
  Layers,
  Database,
  Globe,
  HardDrive,
  Cpu,
  ArrowRight,
  Key,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ComposeService {
  name: string;
  image: string;
  ports: string[];
  environment: string[];
  volumes: string[];
  dependsOn: string[];
  networks: string[];
  restart: string;
  category: "app" | "db" | "cache" | "proxy" | "worker";
}

export function ComposeVisualizer({ composeYaml }: { composeYaml: string }) {
  const parsedData = useMemo(() => {
    try {
      const doc = YAML.parse(composeYaml);
      if (!doc || typeof doc !== "object") return { error: "Invalid YAML document", services: [] };

      const rawServices = doc.services || {};
      const serviceList: ComposeService[] = [];

      for (const [name, config] of Object.entries<any>(rawServices)) {
        const image = config.image || "custom-build";
        const ports = (config.ports || []).map((p: any) => p.toString());
        
        let envList: string[] = [];
        if (Array.isArray(config.environment)) {
          envList = config.environment;
        } else if (config.environment && typeof config.environment === "object") {
          envList = Object.entries(config.environment).map(([k, v]) => `${k}=${v}`);
        }

        const volumes = (config.volumes || []).map((v: any) => v.toString());
        
        let dependsOn: string[] = [];
        if (Array.isArray(config.depends_on)) {
          dependsOn = config.depends_on;
        } else if (config.depends_on && typeof config.depends_on === "object") {
          dependsOn = Object.keys(config.depends_on);
        }

        const networks = Array.isArray(config.networks)
          ? config.networks
          : config.networks
          ? Object.keys(config.networks)
          : ["default"];

        let category: ComposeService["category"] = "app";
        const lowerImg = image.toLowerCase();
        const lowerName = name.toLowerCase();

        if (
          lowerImg.includes("postgres") ||
          lowerImg.includes("mysql") ||
          lowerImg.includes("mariadb") ||
          lowerImg.includes("mongo") ||
          lowerName.includes("db") ||
          lowerName.includes("database")
        ) {
          category = "db";
        } else if (lowerImg.includes("redis") || lowerImg.includes("memcached")) {
          category = "cache";
        } else if (lowerImg.includes("traefik") || lowerImg.includes("nginx") || lowerImg.includes("caddy")) {
          category = "proxy";
        } else if (lowerName.includes("worker") || lowerName.includes("queue") || lowerName.includes("cron")) {
          category = "worker";
        }

        serviceList.push({
          name,
          image,
          ports,
          environment: envList,
          volumes,
          dependsOn,
          networks,
          restart: config.restart || "unless-stopped",
          category,
        });
      }

      return { services: serviceList, error: null };
    } catch (err: any) {
      return { services: [], error: err.message };
    }
  }, [composeYaml]);

  if (parsedData.error) {
    return (
      <div className="p-8 text-center text-rose-500 bg-rose-50/50 rounded-2xl border border-rose-200">
        <p className="font-semibold text-sm">Cannot parse Compose YAML Topology</p>
        <p className="text-xs text-rose-400 mt-1">{parsedData.error}</p>
      </div>
    );
  }

  if (parsedData.services.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <Layers className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-400" />
        <p className="text-sm font-semibold text-slate-700">No Services in Compose File</p>
        <p className="text-xs text-slate-400 mt-0.5">Add service definitions under &apos;services:&apos; to view architecture</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Topology Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-md border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center font-bold shadow-md shadow-pink-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">Stack Architecture Visualizer</h3>
            <p className="text-xs text-slate-400">
              Interactive topology map ({parsedData.services.length} services configured)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30">
            {parsedData.services.filter((s) => s.ports.length > 0).length} Exposed Port(s)
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
            {parsedData.services.filter((s) => s.volumes.length > 0).length} Persistent Volume(s)
          </Badge>
        </div>
      </div>

      {/* Visual Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {parsedData.services.map((service) => {
          const isDb = service.category === "db";
          const isCache = service.category === "cache";
          const isProxy = service.category === "proxy";

          const borderStyle = isDb
            ? "border-emerald-200 hover:border-emerald-400"
            : isCache
            ? "border-amber-200 hover:border-amber-400"
            : isProxy
            ? "border-purple-200 hover:border-purple-400"
            : "border-pink-200 hover:border-pink-400";

          const headerGradient = isDb
            ? "from-emerald-500 to-teal-600"
            : isCache
            ? "from-amber-500 to-orange-600"
            : isProxy
            ? "from-purple-500 to-indigo-600"
            : "from-pink-500 to-rose-600";

          return (
            <div
              key={service.name}
              className={`rounded-2xl bg-white border ${borderStyle} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between`}
            >
              <div>
                {/* Service Header */}
                <div className={`p-4 bg-gradient-to-r ${headerGradient} text-white flex items-center justify-between`}>
                  <div className="flex items-center gap-2.5">
                    {isDb ? (
                      <Database className="h-5 w-5" />
                    ) : isCache ? (
                      <Cpu className="h-5 w-5" />
                    ) : isProxy ? (
                      <Globe className="h-5 w-5" />
                    ) : (
                      <Layers className="h-5 w-5" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm tracking-tight">{service.name}</h4>
                      <span className="text-[11px] opacity-80 block truncate max-w-[180px]">
                        {service.image}
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-white/20 text-white border-white/30 text-[10px] uppercase font-bold">
                    {service.category}
                  </Badge>
                </div>

                {/* Service Details */}
                <div className="p-4 space-y-3 text-xs">
                  {/* Ports */}
                  {service.ports.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Ports & Ingress
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {service.ports.map((p) => (
                          <span
                            key={p}
                            className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-slate-700 text-[11px] flex items-center gap-1"
                          >
                            <Globe className="h-3 w-3 text-pink-500" />
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Volumes */}
                  {service.volumes.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Volume Mounts
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {service.volumes.map((v) => (
                          <span
                            key={v}
                            className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono text-emerald-800 text-[11px] flex items-center gap-1 truncate max-w-full"
                          >
                            <HardDrive className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                            <span className="truncate">{v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dependencies */}
                  {service.dependsOn.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Depends On
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {service.dependsOn.map((dep) => (
                          <span
                            key={dep}
                            className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-[11px] flex items-center gap-1 font-semibold"
                          >
                            <ArrowRight className="h-3 w-3 text-purple-500" />
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Key className="h-3 w-3 text-slate-400" />
                  {service.environment.length} Env Var(s)
                </span>
                <span className="font-mono text-[10px] text-slate-400">{service.restart}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}