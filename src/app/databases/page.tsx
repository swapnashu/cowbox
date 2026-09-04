"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Server,
  FolderKanban,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export default function DatabasesPage() {
  const [databases, setDatabases] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [dbName, setDbName] = useState("");
  const [dbType, setDbType] = useState<"postgres" | "mysql" | "redis" | "mongodb">("postgres");
  const [databaseName, setDatabaseName] = useState("main");
  const [databaseUser, setDatabaseUser] = useState("postgres");
  const [rootPassword, setRootPassword] = useState("");
  const [dbPort, setDbPort] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = async () => {
    try {
      const [dbsRes, projsRes] = await Promise.all([
        fetch("/api/databases"),
        fetch("/api/projects"),
      ]);
      if (dbsRes.ok) setDatabases(await dbsRes.json());
      if (projsRes.ok) {
        const projs = await projsRes.json();
        setProjects(projs);
        if (projs.length > 0 && !selectedProject) {
          setSelectedProject(projs[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName.trim() || !databaseName.trim() || !selectedProject) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject,
          name: dbName,
          type: dbType,
          databaseName,
          databaseUser: databaseUser || (dbType === "postgres" ? "postgres" : "root"),
          rootPassword: rootPassword || undefined,
          exposedPort: dbPort ? parseInt(dbPort, 10) : undefined,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setDbName("");
        setRootPassword("");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this database? All data volumes will be removed.")) return;
    try {
      const res = await fetch(`/api/databases/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleShowPassword = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Managed Databases</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Provision dedicated PostgreSQL, MySQL, Redis, and MongoDB instances across projects.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          disabled={projects.length === 0}
          className="gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20"
        >
          <Plus className="h-4 w-4" />
          Provision Database
        </Button>
      </div>

      {projects.length === 0 && !isLoading && (
        <div className="p-4 bg-pink-50 border border-pink-200 rounded-xl text-xs text-pink-700 flex items-center justify-between">
          <span className="font-semibold">Please create a project environment first before provisioning a database.</span>
          <Link href="/projects">
            <Button size="sm" variant="outline" className="h-8 text-xs font-bold">
              Go to Projects
            </Button>
          </Link>
        </div>
      )}

      {/* Databases Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Loading databases...</div>
      ) : databases.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white">
          <div className="h-12 w-12 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mx-auto mb-3 border border-pink-100">
            <Database className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No databases provisioned yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Provision isolated database containers with persistent storage volumes and instant connection strings.
          </p>
          {projects.length > 0 && (
            <Button onClick={() => setIsModalOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Provision First Database
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {databases.map((db) => {
            const host = `cowbox-db-${db.name}`;
            const user = db.databaseUser || "postgres";
            const pass = db.rootPassword;
            const port = db.internalPort;
            const dbName = db.databaseName;
            
            let connUrl = "";
            if (db.type === "postgres") connUrl = `postgresql://${user}:${pass}@${host}:${port}/${dbName}`;
            else if (db.type === "mysql" || db.type === "mariadb") connUrl = `mysql://${user}:${pass}@${host}:${port}/${dbName}`;
            else if (db.type === "redis") connUrl = `redis://:${pass}@${host}:${port}`;
            else if (db.type === "mongodb") connUrl = `mongodb://${user}:${pass}@${host}:${port}/${dbName}`;

            const isPassVisible = showPasswordMap[db.id];

            return (
              <Card key={db.id} className="hover:border-pink-300 hover:shadow-md transition-all flex flex-col justify-between group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Link href={`/databases/${db.id}`} className="flex items-center gap-3 flex-1">
                      <div className="p-2.5 rounded-xl bg-pink-50 text-pink-600 border border-pink-200 group-hover:scale-105 transition-transform">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold capitalize group-hover:text-pink-600 transition-colors">{db.name}</CardTitle>
                        <CardDescription className="font-mono mt-0.5">
                          Engine: {db.type} (Port {db.internalPort})
                        </CardDescription>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="capitalize text-[11px]">
                        {db.status}
                      </Badge>
                      <button
                        onClick={() => handleDelete(db.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Database"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                      <span>Internal Host (Docker Network):</span>
                      <span className="font-mono font-bold text-slate-800">{host}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500 font-medium">
                      <span>Database Name:</span>
                      <span className="font-mono font-bold text-slate-800">{db.databaseName}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500 font-medium">
                      <span>Username:</span>
                      <span className="font-mono font-bold text-slate-800">{db.databaseUser || "root"}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500 font-medium">
                      <span>Password:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">
                          {isPassVisible ? pass : "••••••••••••"}
                        </span>
                        <button
                          onClick={() => toggleShowPassword(db.id)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {isPassVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Connection String Helper */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                      <span>Internal Connection String</span>
                      <button
                        onClick={() => copyToClipboard(connUrl, db.id)}
                        className="text-pink-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        {copiedId === db.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy URL
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] bg-slate-100 p-2.5 rounded-lg border border-slate-200 text-slate-800 truncate font-semibold">
                      {connUrl}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Provision Database Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision Managed Database"
        description="Select database engine and project association."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Assign to Project *</label>
            <select
              className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 font-medium"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Database Engine</label>
            <div className="grid grid-cols-4 gap-2">
              {(["postgres", "mysql", "redis", "mongodb"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDbType(t);
                    setDatabaseUser(t === "postgres" ? "postgres" : "root");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold capitalize transition-all ${
                    dbType === t
                      ? "border-pink-500 bg-pink-50 text-pink-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Identifier Name *</label>
            <Input
              placeholder="e.g. main-db, auth-redis"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Database Name *</label>
              <Input
                placeholder="main"
                value={databaseName}
                onChange={(e) => setDatabaseName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Username</label>
              <Input
                value={databaseUser}
                onChange={(e) => setDatabaseUser(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Password (Auto-generated if empty)</label>
            <Input
              type="password"
              placeholder="••••••••••••"
              value={rootPassword}
              onChange={(e) => setRootPassword(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Provision Database
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
