"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Zap,
  Globe,
  Database,
  Activity,
  HardDrive,
  BookOpen,
  Search,
  Shield,
  BarChart3,
  Layers,
  ArrowRight,
  Plus,
  Check,
  Wand2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { APP_TEMPLATES, AppTemplate } from "@/lib/templates";

export default function TemplatesCatalogPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTemplate, setSelectedTemplate] = useState<AppTemplate | null>(null);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [customAppName, setCustomAppName] = useState("");
  const [customEnv, setCustomEnv] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data || []);
          if (data && data.length > 0) setTargetProjectId(data[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleOpenDeploy = (tmpl: AppTemplate) => {
    setSelectedTemplate(tmpl);
    setCustomAppName(tmpl.id + "-" + Math.floor(Math.random() * 1000));
    setCustomEnv(tmpl.defaultEnv || "");
    setIsDeployModalOpen(true);
  };

  const handleDeployTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !targetProjectId || !customAppName.trim()) return;

    setIsDeploying(true);
    try {
      // 1. Create Application
      const appRes = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: targetProjectId,
          name: customAppName.trim(),
          appType: "image",
          dockerImage: selectedTemplate.image,
          containerPort: selectedTemplate.containerPort,
          envVars: customEnv,
        }),
      });

      if (appRes.ok) {
        const appData = await appRes.json();
        // 2. Trigger auto-deploy
        await fetch(`/api/applications/${appData.id}/deploy`, { method: "POST" });
        setIsDeployModalOpen(false);
        router.push(`/applications/${appData.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeploying(false);
    }
  };

  const categories = ["All", "CMS", "Backend", "Automation", "Monitoring", "Storage", "Search", "Security", "Analytics", "Web Server"];

  const filtered = APP_TEMPLATES.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === "All") return true;
    return t.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const getTemplateIcon = (id: string) => {
    switch (id) {
      case "wordpress":
        return <Globe className="h-6 w-6 text-pink-600" />;
      case "pocketbase":
        return <Database className="h-6 w-6 text-amber-500" />;
      case "n8n":
        return <Zap className="h-6 w-6 text-emerald-600" />;
      case "uptime-kuma":
        return <Activity className="h-6 w-6 text-emerald-500" />;
      case "minio":
        return <HardDrive className="h-6 w-6 text-rose-500" />;
      case "ghost":
        return <BookOpen className="h-6 w-6 text-blue-500" />;
      case "meilisearch":
        return <Search className="h-6 w-6 text-pink-500" />;
      case "vaultwarden":
        return <Shield className="h-6 w-6 text-indigo-500" />;
      case "plausible":
        return <BarChart3 className="h-6 w-6 text-teal-600" />;
      default:
        return <Layers className="h-6 w-6 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-600" />
            1-Click App Template Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Launch verified open-source web services, databases, and microservices in seconds with zero configuration.
          </p>
        </div>
      </div>

      {/* Category Pills & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-pink-50 text-pink-600 border border-pink-200 shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tmpl) => (
          <Card key={tmpl.id} className="hover:border-pink-300 hover:shadow-md transition-all flex flex-col justify-between group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 group-hover:scale-105 transition-transform">
                    {getTemplateIcon(tmpl.id)}
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold group-hover:text-pink-600 transition-colors">
                      {tmpl.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-semibold mt-0.5">
                      {tmpl.category}
                    </Badge>
                  </div>
                </div>

                <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
                  :{tmpl.containerPort}
                </span>
              </div>

              <CardDescription className="text-xs mt-3 leading-relaxed text-slate-600">
                {tmpl.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 p-4">
              <span className="font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={tmpl.image}>
                {tmpl.image}
              </span>

              <Button
                onClick={() => handleOpenDeploy(tmpl)}
                size="sm"
                variant="success"
                className="gap-1 text-xs font-bold shadow-sm shadow-emerald-500/20"
              >
                <Zap className="h-3.5 w-3.5" />
                Launch App
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deploy Template Modal */}
      <Modal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        title={`Launch ${selectedTemplate?.name}`}
        description={`Deploy ${selectedTemplate?.name} container with automated Traefik routing.`}
      >
        <form onSubmit={handleDeployTemplate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Target Project *</label>
            {projects.length === 0 ? (
              <div className="text-xs text-pink-600 bg-pink-50 p-3 rounded-lg border border-pink-200">
                No projects found. Please create a project first.
              </div>
            ) : (
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Application Identifier *</label>
            <Input
              value={customAppName}
              onChange={(e) => setCustomAppName(e.target.value)}
              placeholder="e.g. my-wordpress, n8n-automation"
              required
            />
          </div>

          {selectedTemplate?.defaultEnv && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Environment Variables</label>
              <textarea
                value={customEnv}
                onChange={(e) => setCustomEnv(e.target.value)}
                className="w-full h-28 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none leading-relaxed"
                placeholder="KEY=VALUE"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsDeployModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isDeploying} variant="success" className="font-bold">
              Deploy & Launch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
