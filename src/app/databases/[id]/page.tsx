"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Database,
  Terminal,
  ShieldCheck,
  RotateCw,
  Square,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  HardDrive,
  Download,
  ExternalLink,
  Code2,
  FileCode,
  Zap,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/utils";

type TabType = "connect" | "terminal" | "gui" | "backups";

export default function DatabaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dbId = params.id as string;

  const [dbData, setDbData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>("connect");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [selectedLang, setSelectedLang] = useState<"prisma" | "node" | "python" | "go">("prisma");
  
  // GUI & Backups State
  const [guiUrl, setGuiUrl] = useState<string | null>(null);
  const [isLaunchingGui, setIsLaunchingGui] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // In-Container DB Shell
  const [dbShellCmd, setDbShellCmd] = useState("");
  const [shellHistory, setShellHistory] = useState<Array<{ cmd: string; out: string; success: boolean }>>([]);
  const [isExecutingDbShell, setIsExecutingDbShell] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchDatabase = async () => {
    try {
      const res = await fetch(`/api/databases/${dbId}`);
      if (res.ok) {
        setDbData(await res.json());
      } else {
        router.push("/databases");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch(`/api/databases/${dbId}/backup`);
      if (res.ok) {
        setBackups(await res.json());
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchDatabase();
    fetchBackups();
  }, [dbId]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLaunchGui = async () => {
    setIsLaunchingGui(true);
    try {
      const res = await fetch(`/api/databases/${dbId}/gui`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setGuiUrl(data.url);
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLaunchingGui(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await fetch(`/api/databases/${dbId}/backup`, { method: "POST" });
      if (res.ok) {
        await fetchBackups();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`Restore database from snapshot "${filename}"? Current data will be overwritten.`)) return;
    setIsRestoring(true);
    setRestoreStatus(null);
    try {
      const res = await fetch(`/api/databases/${dbId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (res.ok) {
        setRestoreStatus(data.message || "Snapshot restored successfully!");
        setTimeout(() => setRestoreStatus(null), 4000);
      } else {
        setRestoreStatus(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setRestoreStatus(`Error: ${e.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRunDbShell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbShellCmd.trim() || !dbData?.containerId) return;

    const cmd = dbShellCmd.trim();
    setIsExecutingDbShell(true);
    try {
      let fullCommand = cmd;
      if (dbData.type === "postgres") {
        fullCommand = `psql -U ${dbData.databaseUser || "postgres"} -d ${dbData.databaseName} -c "${cmd}"`;
      } else if (dbData.type === "mysql" || dbData.type === "mariadb") {
        fullCommand = `mysql -u ${dbData.databaseUser || "root"} -p${dbData.rootPassword} ${dbData.databaseName} -e "${cmd}"`;
      } else if (dbData.type === "redis") {
        fullCommand = `redis-cli ${cmd}`;
      }

      const res = await fetch(`/api/containers/${dbData.containerId}/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: fullCommand }),
      });
      const data = await res.json();
      setShellHistory((prev) => [...prev, { cmd, out: data.output || data.error, success: data.success }]);
      setDbShellCmd("");
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err: any) {
      setShellHistory((prev) => [...prev, { cmd, out: err.message, success: false }]);
    } finally {
      setIsExecutingDbShell(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this database? All data volumes will be permanently lost.")) return;
    try {
      const res = await fetch(`/api/databases/${dbId}`, { method: "DELETE" });
      if (res.ok) router.push(`/projects/${dbData.projectId}`);
    } catch (e) {}
  };

  if (isLoading) {
    return <div className="text-center py-16 text-slate-400">Loading database workspace...</div>;
  }

  if (!dbData) return null;

  const host = `cowbox-db-${dbData.name}`;
  const user = dbData.databaseUser || (dbData.type === "postgres" ? "postgres" : "root");
  const pass = dbData.rootPassword;
  const port = dbData.internalPort;
  const dbName = dbData.databaseName;

  let connUrl = `postgresql://${user}:${pass}@${host}:${port}/${dbName}`;
  if (dbData.type === "mysql" || dbData.type === "mariadb") connUrl = `mysql://${user}:${pass}@${host}:${port}/${dbName}`;
  else if (dbData.type === "redis") connUrl = `redis://:${pass}@${host}:${port}`;
  else if (dbData.type === "mongodb") connUrl = `mongodb://${user}:${pass}@${host}:${port}/${dbName}`;

  const getCodeSnippet = () => {
    switch (selectedLang) {
      case "prisma":
        return `// schema.prisma
datasource db {
  provider = "${dbData.type === "postgres" ? "postgresql" : dbData.type === "mysql" ? "mysql" : "mongodb"}"
  url      = env("DATABASE_URL")
}

// .env
DATABASE_URL="${connUrl}"`;
      case "node":
        return `// Node.js Connection
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "${connUrl}",
});

async function queryDb() {
  const res = await pool.query('SELECT NOW()');
  console.log(res.rows[0]);
}`;
      case "python":
        return `# Python SQLAlchemy / psycopg2
import os
from sqlalchemy import create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "${connUrl}")
engine = create_engine(DATABASE_URL)

with engine.connect() as connection:
    result = connection.execute("SELECT 1")
    print("Database connected successfully!")`;
      case "go":
        return `// Go database/sql
package main

import (
  "database/sql"
  "fmt"
  _ "github.com/lib/pq"
)

func main() {
  connStr := "${connUrl}"
  db, err := sql.Open("postgres", connStr)
  if err != nil { panic(err) }
  defer db.Close()
  fmt.Println("Connected to Cowbox Database!")
}`;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${dbData.projectId}`}
          className="text-xs font-semibold text-pink-600 hover:underline flex items-center gap-1.5 mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Project
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-pink-500/20 font-bold">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 capitalize">{dbData.name}</h1>
                <Badge variant="success" className="capitalize text-[11px] font-bold">
                  {dbData.type} ({dbData.status})
                </Badge>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Internal Host: {host}:{port} • Volume: {dbData.volumeName || "cowbox-data"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleLaunchGui}
              isLoading={isLaunchingGui}
              size="sm"
              variant="outline"
              className="gap-1.5 text-pink-600 border-pink-200 hover:bg-pink-50 font-bold"
            >
              <ExternalLink className="h-4 w-4" />
              Open Web GUI
            </Button>
            <Button
              onClick={handleCreateBackup}
              isLoading={isCreatingBackup}
              size="sm"
              variant="success"
              className="gap-1.5 shadow-md shadow-emerald-500/20 font-bold"
            >
              <HardDrive className="h-4 w-4" />
              Snapshot Backup
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-px overflow-x-auto">
        {(
          [
            { id: "connect", label: "Connection & Code", icon: Code2 },
            { id: "terminal", label: "SQL Shell CLI", icon: Terminal },
            { id: "gui", label: "Web Database Manager", icon: ExternalLink },
            { id: "backups", label: `Snapshot Backups (${backups.length})`, icon: HardDrive },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-pink-500 text-pink-600 bg-pink-50/50 rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Restore Status Toast */}
      {restoreStatus && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {restoreStatus}
        </div>
      )}

      {/* Tab Content */}
      <div className="pt-2">
        {/* Connection & Code Tab */}
        {activeTab === "connect" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 space-y-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Internal Connection URI</CardTitle>
                <CardDescription>Use this URI to connect any app on the cowbox-network</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input readOnly value={connUrl} className="font-mono text-xs bg-slate-50 text-slate-800" />
                  <Button
                    onClick={() => copyToClipboard(connUrl, "uri")}
                    size="sm"
                    variant="outline"
                    className="font-bold text-pink-600 border-pink-200 hover:bg-pink-50 whitespace-nowrap"
                  >
                    {copiedKey === "uri" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copiedKey === "uri" ? "Copied!" : "Copy URI"}
                  </Button>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                    <span className="text-xs font-bold text-slate-800">Framework Code Snippet</span>
                    <div className="flex gap-1">
                      {(["prisma", "node", "python", "go"] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setSelectedLang(lang)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md capitalize transition-all ${
                            selectedLang === lang
                              ? "bg-pink-50 text-pink-600 border border-pink-200"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed shadow-inner">
                      {getCodeSnippet()}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(getCodeSnippet(), "snippet")}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Copy Snippet"
                    >
                      {copiedKey === "snippet" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Credentials Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Credentials & Parameters</CardTitle>
                <CardDescription>Detailed host and port mapping</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Engine</span>
                  <span className="font-bold text-slate-800 uppercase">{dbData.type}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Host (Docker Bridge)</span>
                  <span className="font-mono font-bold text-slate-800">{host}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Internal Port</span>
                  <span className="font-mono font-bold text-slate-800">{port}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Database Name</span>
                  <span className="font-mono font-bold text-slate-800">{dbName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Username</span>
                  <span className="font-mono font-bold text-slate-800">{user}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Password</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                    <span>{isPasswordVisible ? pass : "••••••••••••"}</span>
                    <button onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="text-slate-400 hover:text-slate-700">
                      {isPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SQL Shell CLI Tab */}
        {activeTab === "terminal" && (
          <Card className="overflow-hidden bg-slate-950 border-slate-800 shadow-md">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span>Direct Database SQL Shell ({dbData.type})</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShellHistory([])}
                className="h-7 text-xs gap-1 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Clear History
              </Button>
            </div>

            <div className="p-4 font-mono text-xs max-h-[420px] overflow-y-auto leading-relaxed terminal-scroll bg-black/60 min-h-[220px] space-y-3">
              {shellHistory.length === 0 ? (
                <div className="text-slate-500 italic">
                  Run SQL queries or commands directly inside the database container (e.g. <code>SELECT NOW();</code>, <code>\dt</code>, <code>SHOW TABLES;</code>, <code>INFO</code>)...
                </div>
              ) : (
                shellHistory.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-emerald-400 font-bold">&gt; {item.cmd}</div>
                    <pre className={`whitespace-pre-wrap ${item.success ? "text-slate-200" : "text-rose-400"}`}>
                      {item.out}
                    </pre>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>

            <form onSubmit={handleRunDbShell} className="p-2.5 bg-slate-900 border-t border-slate-800 flex gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400 self-center pl-2">&gt;</span>
              <input
                type="text"
                placeholder="Enter SQL command (e.g. SELECT * FROM users LIMIT 5;)..."
                value={dbShellCmd}
                onChange={(e) => setDbShellCmd(e.target.value)}
                disabled={!dbData?.containerId || isExecutingDbShell}
                className="flex-1 bg-transparent text-xs font-mono text-slate-100 focus:outline-none placeholder:text-slate-600"
              />
              <Button type="submit" isLoading={isExecutingDbShell} size="sm" variant="success" className="h-8 text-xs font-bold px-3">
                Execute SQL
              </Button>
            </form>
          </Card>
        )}

        {/* Web Database Manager Tab */}
        {activeTab === "gui" && (
          <Card className="p-8 text-center bg-white">
            <div className="h-12 w-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mx-auto mb-3 border border-pink-100">
              <ExternalLink className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Adminer & Web GUI Manager</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Query tables, insert rows, export SQL dumps, and inspect database schemas directly in your browser with automatic <code>sslip.io</code> routing.
            </p>
            <Button onClick={handleLaunchGui} isLoading={isLaunchingGui} variant="success" className="font-bold">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Launch Web Database GUI
            </Button>
          </Card>
        )}

        {/* Snapshot Backups Tab */}
        {activeTab === "backups" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Snapshot Dumps ({backups.length})</span>
              <Button onClick={handleCreateBackup} isLoading={isCreatingBackup} size="sm" variant="success" className="font-bold gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                Create Snapshot Now
              </Button>
            </div>

            {backups.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-slate-300 bg-white">
                <HardDrive className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800">No snapshot backups yet</h3>
                <p className="text-xs text-slate-500 mt-1 mb-3">
                  Click above to create your first point-in-time SQL snapshot backup.
                </p>
              </Card>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {backups.map((b) => (
                  <div key={b.filename} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 block">{b.filename}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {formatBytes(b.sizeBytes)} • {new Date(b.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleRestoreBackup(b.filename)}
                        isLoading={isRestoring}
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
