"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import templatesData from "@/lib/templates.json";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Sparkles, Zap, Layers, Search } from "lucide-react";
import Image from "next/image";

interface AppTemplate {
  id: string;
  name: string;
  description: string;
  logo: string;
  composeYaml: string;
}

const APP_TEMPLATES: AppTemplate[] = templatesData as AppTemplate[];

export default function TemplatesCatalogPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AppTemplate | null>(null);
  
  // Form State
  const [targetProjectId, setTargetProjectId] = useState("");
  const [customAppName, setCustomAppName] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
          if (data.projects && data.projects.length > 0) {
            setTargetProjectId(data.projects[0].id);
          }
        }
      } catch (e) {}
    }
    fetchProjects();
  }, []);

  const handleOpenDeploy = (tmpl: AppTemplate) => {
    setSelectedTemplate(tmpl);
    setCustomAppName(tmpl.id);
    setIsDeployModalOpen(true);
  };

  const handleDeployTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !targetProjectId) return;
    
    setIsDeploying(true);
    try {
      const appRes = await fetch("/api/compose/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: targetProjectId,
          name: customAppName,
          composeYaml: selectedTemplate.composeYaml
        }),
      });

      if (!appRes.ok) throw new Error("Failed to deploy template");
      const { stack } = await appRes.json();
      
      setIsDeployModalOpen(false);
      router.push(`/projects/${targetProjectId}`);
    } catch (err) {
      alert("Error deploying template.");
    } finally {
      setIsDeploying(false);
    }
  };

  const filtered = APP_TEMPLATES.filter((t) => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-600" />
            1-Click App Store
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Launch verified open-source web services in seconds.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-end gap-3">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tmpl) => (
          <Card key={tmpl.id} className="hover:border-pink-300 hover:shadow-md transition-all flex flex-col justify-between group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 relative flex items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200 group-hover:scale-105 transition-transform overflow-hidden">
                     {tmpl.logo.startsWith("http") ? (
                       <img src={tmpl.logo} alt={tmpl.name} className="object-contain w-full h-full" />
                     ) : (
                       <Layers className="h-6 w-6 text-slate-500" />
                     )}
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold group-hover:text-pink-600 transition-colors">
                      {tmpl.name}
                    </CardTitle>
                  </div>
                </div>
              </div>
              <CardDescription className="text-xs mt-3 leading-relaxed text-slate-600">
                {tmpl.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/50 p-4">
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

      <Modal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        title={`Launch ${selectedTemplate?.name}`}
        description={`Deploy this stack instantly.`}
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
            <label className="text-xs font-semibold text-slate-700">Stack Name *</label>
            <Input
              value={customAppName}
              onChange={(e) => setCustomAppName(e.target.value)}
              placeholder="e.g. my-wordpress"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsDeployModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isDeploying} variant="success" className="font-bold">
              {isDeploying ? "Deploying..." : "Deploy"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
