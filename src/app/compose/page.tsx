"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Sparkles,
  Play,
  RotateCw,
  Square,
  FileCode,
  Check,
  Zap,
  FolderKanban,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const COMPOSE_TEMPLATES: Record<string, { title: string; yaml: string }> = {
  fullstack: {
    title: "Full Stack (Next.js + Postgres + Redis)",
    yaml: `version: '3.8'

services:
  web:
    image: nginx:alpine
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:secret@db:5432/main
      - REDIS_URL=redis://cache:6379
    restart: unless-stopped
    networks:
      - cowbox-network

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=main
    volumes:
      - cowbox-data-compose-db:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - cowbox-network

  cache:
    image: redis:7-alpine
    restart: unless-stopped
    networks:
      - cowbox-network

networks:
  cowbox-network:
    external: true`,
  },
  mern: {
    title: "MERN Stack (Node API + MongoDB)",
    yaml: `version: '3.8'

services:
  api:
    image: node:20-alpine
    command: sh -c "echo 'Node API started' && sleep infinity"
    ports:
      - "5000:5000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/appdb
    networks:
      - cowbox-network

  mongo:
    image: mongo:7.0
    volumes:
      - cowbox-data-mern-mongo:/data/db
    networks:
      - cowbox-network

networks:
  cowbox-network:
    external: true`,
  },
  fastapi: {
    title: "Python FastAPI + Postgres + Redis Worker",
    yaml: `version: '3.8'

services:
  app:
    image: python:3.11-slim
    command: sh -c "echo 'FastAPI Server Ready' && sleep infinity"
    ports:
      - "8000:8000"
    networks:
      - cowbox-network

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_PASSWORD=fastapipass
      - POSTGRES_DB=fastapi_db
    networks:
      - cowbox-network

networks:
  cowbox-network:
    external: true`,
  },
};

export default function ComposePage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [stackName, setStackName] = useState("my-stack");
  const [composeYaml, setComposeYaml] = useState(COMPOSE_TEMPLATES.fullstack.yaml);
  const [envVars, setEnvVars] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data || []);
          if (data && data.length > 0) setSelectedProjectId(data[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadProjects();
  }, []);

  const handleDeployStack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stackName.trim() || !composeYaml.trim()) return;

    setIsDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch("/api/compose/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId || projects[0]?.id,
          name: stackName.trim(),
          composeYaml,
          envVars,
        }),
      });
      const data = await res.json();
      setDeployResult(data);
    } catch (e: any) {
      setDeployResult({ error: e.message });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-600" />
            Docker Compose Multi-Service Stacks
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Orchestrate multi-container architecture from standard <code>docker-compose.yml</code> templates.
          </p>
        </div>
      </div>

      {/* Preset Stack Selection */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
        <span className="font-bold text-slate-700 flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-pink-500" />
          Stack Presets:
        </span>
        {Object.entries(COMPOSE_TEMPLATES).map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => setComposeYaml(v.yaml)}
            className="px-2.5 py-1 bg-white hover:bg-pink-50 hover:text-pink-600 rounded-lg border border-slate-200 font-semibold transition-colors shadow-sm"
          >
            + {v.title}
          </button>
        ))}
      </div>

      {/* Deploy Status Toast */}
      {deployResult && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-start gap-2 border ${
            deployResult.success
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "bg-rose-50 border-rose-300 text-rose-800"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <div>{deployResult.message || deployResult.error}</div>
            {deployResult.services && (
              <div className="mt-1 font-mono font-normal text-[11px] text-emerald-700">
                Active Services: {deployResult.services.join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose Editor Grid */}
      <form onSubmit={handleDeployStack} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 flex flex-col shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCode className="h-4 w-4 text-pink-600" />
                docker-compose.yml Editor
              </CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              YAML Syntax
            </Badge>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            <textarea
              value={composeYaml}
              onChange={(e) => setComposeYaml(e.target.value)}
              className="w-full h-[450px] p-4 font-mono text-xs text-slate-900 bg-white resize-none focus:outline-none leading-relaxed terminal-scroll"
              spellCheck={false}
              required
            />
          </CardContent>
        </Card>

        {/* Stack Configuration (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Stack Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Stack Identifier *</label>
                <Input
                  value={stackName}
                  onChange={(e) => setStackName(e.target.value)}
                  placeholder="e.g. backend-cluster"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Environment Variables</label>
                <textarea
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                  placeholder="NODE_ENV=production&#10;PORT=80"
                  className="w-full h-28 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                isLoading={isDeploying}
                variant="success"
                className="w-full font-bold shadow-md shadow-emerald-500/20"
              >
                <Play className="h-4 w-4 mr-1.5" />
                Deploy Compose Stack
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
