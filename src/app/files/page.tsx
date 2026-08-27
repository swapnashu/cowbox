"use client";

import { useState, useEffect, useRef } from "react";
import {
  FolderCode,
  FileCode,
  Folder,
  FolderPlus,
  FilePlus,
  Play,
  Save,
  Trash2,
  Terminal,
  RefreshCw,
  Search,
  Code2,
  Check,
  Clock,
  Sparkles,
  Zap,
  HardDrive,
  Copy,
  ChevronRight,
  Download,
  Upload,
  Layers,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatBytes } from "@/lib/utils";

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  extension: string;
  updatedAt: string;
}

const TEMPLATE_SNIPPETS: Record<string, { filename: string; content: string }> = {
  express: {
    filename: "server.js",
    content: `// Express.js Web Server in Cowbox
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: "🐮 Hello from Cowbox Code Runner!",
    path: req.url,
    timestamp: new Date().toISOString()
  }, null, 2));
});

const PORT = process.env.PORT || 8080;
console.log(\`Server starting on port \${PORT}...\`);
server.listen(PORT, () => {
  console.log(\`🚀 Server running at http://localhost:\${PORT}\`);
});
`,
  },
  fastapi: {
    filename: "app.py",
    content: `# Python API / Automation Example
import json
import sys
import datetime

def main():
    print(f"🐮 Cowbox Python Engine: {sys.version.split()[0]}")
    payload = {
        "status": "online",
        "service": "cowbox-worker",
        "timestamp": str(datetime.datetime.now()),
        "metrics": {"cpu": "0.1%", "ram": "24MB"}
    }
    print(json.dumps(payload, indent=2))

if __name__ == "__main__":
    main()
`,
  },
  bash_audit: {
    filename: "audit.sh",
    content: `#!/usr/bin/env bash
# Cowbox System Diagnostic Script
echo "================================="
echo "🐮 COWBOX SYSTEM AUDIT"
echo "================================="
echo "Hostname: $(hostname)"
echo "Current User: $(whoami 2>/dev/null || echo 'app')"
echo "Node Version: $(node -v 2>/dev/null || echo 'Not installed')"
echo "Python Version: $(python -V 2>/dev/null || echo 'Not installed')"
echo "Workspace Path: $(pwd)"
echo "================================="
`,
  },
  html: {
    filename: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cowbox Landing Page</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: white; padding: 2.5rem; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
    h1 { color: #db2777; margin: 0 0 0.5rem; }
    p { color: #64748b; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🐮 Cowbox Live App</h1>
    <p>Deployed with zero configuration</p>
  </div>
</body>
</html>
`,
  },
};

export default function FileManagerPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentDir, setCurrentDir] = useState("");
  const [activeFile, setActiveFile] = useState<string>("index.js");
  const [fileContent, setFileContent] = useState<string>("");
  const [isSaved, setIsSaved] = useState(true);
  const [search, setSearch] = useState("");
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Modals & Presets
  const [isNewFileModal, setIsNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isNewDirModal, setIsNewDirModal] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Code Runner & Terminal State
  const [customCommand, setCustomCommand] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [runOutput, setRunOutput] = useState<{
    command?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    durationMs?: number;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchFiles = async (dir = "") => {
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dir)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.items || []);
        setCurrentDir(data.currentPath || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const openFile = async (filePath: string) => {
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveFile(data.path);
        setFileContent(data.content || "");
        setIsSaved(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFiles();
    openFile("index.js");
  }, []);

  // Keyboard shortcut Ctrl+S or Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, fileContent]);

  const handleSaveFile = async () => {
    if (!activeFile) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: activeFile, content: fileContent }),
      });
      if (res.ok) {
        setIsSaved(true);
        fetchFiles(currentDir);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadFile = () => {
    if (!activeFile) return;
    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile.split("/").pop() || "download";
    a.click();
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetDir", currentDir);

      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchFiles(currentDir);
        openFile(currentDir ? `${currentDir}/${file.name}` : file.name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyTemplateSnippet = async (key: string) => {
    const snippet = TEMPLATE_SNIPPETS[key];
    if (!snippet) return;

    const fullPath = currentDir ? `${currentDir}/${snippet.filename}` : snippet.filename;
    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: fullPath, content: snippet.content }),
      });
      await fetchFiles(currentDir);
      openFile(fullPath);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const fullPath = currentDir ? `${currentDir}/${newFileName.trim()}` : newFileName.trim();
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: fullPath, content: `// ${newFileName}\n` }),
      });
      if (res.ok) {
        setIsNewFileModal(false);
        setNewFileName("");
        await fetchFiles(currentDir);
        openFile(fullPath);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateDir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirName.trim()) return;

    const fullPath = currentDir ? `${currentDir}/${newDirName.trim()}` : newDirName.trim();
    try {
      const res = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirPath: fullPath }),
      });
      if (res.ok) {
        setIsNewDirModal(false);
        setNewDirName("");
        fetchFiles(currentDir);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`, { method: "DELETE" });
      if (res.ok) {
        fetchFiles(currentDir);
        if (activeFile === filePath) {
          setActiveFile("");
          setFileContent("");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunFile = async () => {
    if (!activeFile) return;
    await handleSaveFile();
    setIsRunning(true);
    try {
      const res = await fetch("/api/files/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: activeFile }),
      });
      const data = await res.json();
      setRunOutput(data);
    } catch (e: any) {
      setRunOutput({ stderr: e.message, exitCode: 1 });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCustomCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCommand.trim()) return;
    setIsRunning(true);
    try {
      const res = await fetch("/api/files/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: customCommand.trim() }),
      });
      const data = await res.json();
      setRunOutput(data);
      setCustomCommand("");
    } catch (e: any) {
      setRunOutput({ stderr: e.message, exitCode: 1 });
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDownEditor = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = fileContent.substring(0, start) + "  " + fileContent.substring(end);
      setFileContent(newValue);
      setIsSaved(false);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const getFileIcon = (ext: string, isDir: boolean) => {
    if (isDir) return <Folder className="h-4 w-4 text-pink-500 fill-pink-500/20" />;
    switch (ext) {
      case "js":
      case "mjs":
        return <FileCode className="h-4 w-4 text-amber-500" />;
      case "ts":
      case "tsx":
        return <FileCode className="h-4 w-4 text-blue-500" />;
      case "py":
        return <FileCode className="h-4 w-4 text-emerald-600" />;
      case "sh":
      case "bash":
        return <Terminal className="h-4 w-4 text-emerald-500" />;
      case "json":
      case "yaml":
      case "yml":
        return <FileCode className="h-4 w-4 text-rose-500" />;
      default:
        return <FileCode className="h-4 w-4 text-slate-400" />;
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FolderCode className="h-6 w-6 text-pink-600" />
              File Manager & Code Runner
            </h1>
            <Badge variant="pink" className="text-[11px] font-mono">
              data/workspace
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Create, edit, upload, organize, and execute Node.js, Python, Shell, and Go scripts in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset Snippets */}
          <div className="hidden md:flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-[11px] font-bold text-slate-500 px-2">Presets:</span>
            <button
              onClick={() => handleApplyTemplateSnippet("express")}
              className="px-2 py-1 bg-white hover:bg-pink-50 hover:text-pink-600 rounded border border-slate-200 font-semibold transition-colors"
            >
              + Node Server
            </button>
            <button
              onClick={() => handleApplyTemplateSnippet("fastapi")}
              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded border border-slate-200 font-semibold transition-colors"
            >
              + Python API
            </button>
            <button
              onClick={() => handleApplyTemplateSnippet("bash_audit")}
              className="px-2 py-1 bg-white hover:bg-slate-100 rounded border border-slate-200 font-semibold transition-colors"
            >
              + Shell Script
            </button>
          </div>

          <Button
            onClick={handleSaveFile}
            isLoading={isSaving}
            variant="outline"
            size="sm"
            className="gap-1.5 font-bold text-slate-700 hover:text-pink-600 hover:border-pink-300"
          >
            <Save className="h-4 w-4 text-pink-500" />
            Save ({isSaved ? "Saved" : "Modified"})
          </Button>

          <Button
            onClick={handleRunFile}
            isLoading={isRunning}
            size="sm"
            variant="success"
            className="gap-1.5 shadow-md shadow-emerald-500/20 font-bold"
          >
            <Play className="h-4 w-4" />
            Run File
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Explorer (4 cols) */}
        <Card className="lg:col-span-4 h-[750px] flex flex-col justify-between shadow-sm">
          <div className="p-3 border-b border-slate-100 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Folder className="h-4 w-4 text-pink-500" />
                Workspace Files
              </span>
              <div className="flex items-center gap-1">
                <label className="p-1.5 rounded-lg hover:bg-pink-50 text-slate-500 hover:text-pink-600 cursor-pointer transition-colors" title="Upload File">
                  <input type="file" onChange={handleUploadFile} className="hidden" />
                  <Upload className="h-4 w-4" />
                </label>
                <button
                  onClick={() => setIsNewFileModal(true)}
                  title="New File"
                  className="p-1.5 rounded-lg hover:bg-pink-50 text-slate-500 hover:text-pink-600 transition-colors"
                >
                  <FilePlus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsNewDirModal(true)}
                  title="New Directory"
                  className="p-1.5 rounded-lg hover:bg-pink-50 text-slate-500 hover:text-pink-600 transition-colors"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => fetchFiles(currentDir)}
                  title="Refresh"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filter files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 terminal-scroll">
            {isLoadingFiles ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading workspace files...</div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No files found.</div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = activeFile === file.path;
                return (
                  <div
                    key={file.path}
                    onClick={() => {
                      if (file.isDirectory) {
                        setCurrentDir(file.path);
                        fetchFiles(file.path);
                      } else {
                        openFile(file.path);
                      }
                    }}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all group ${
                      isSelected
                        ? "bg-pink-50 text-pink-700 font-bold border border-pink-200/80 shadow-sm"
                        : "text-slate-700 hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getFileIcon(file.extension, file.isDirectory)}
                      <span className="truncate">{file.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!file.isDirectory && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatBytes(file.sizeBytes, 0)}
                        </span>
                      )}
                      <button
                        onClick={(e) => handleDeleteFile(file.path, e)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-pink-500" />
              Ctrl+S to save
            </span>
            <span className="font-mono text-emerald-600 font-semibold">Ready</span>
          </div>
        </Card>

        {/* Right Editor + Console (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="shadow-sm overflow-hidden flex flex-col h-[450px]">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-pink-600" />
                <span className="font-mono font-bold text-xs text-slate-800">
                  {activeFile || "Select a file to edit"}
                </span>
                {!isSaved && (
                  <span className="h-2 w-2 rounded-full bg-pink-500 animate-pulse" title="Unsaved changes"></span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadFile}
                  title="Download File"
                  className="p-1 rounded text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-mono text-slate-500">
                  {fileContent.split("\n").length} lines
                </span>
                <Button
                  onClick={handleRunFile}
                  isLoading={isRunning}
                  size="sm"
                  variant="success"
                  className="h-7 px-2.5 text-xs font-bold gap-1"
                >
                  <Play className="h-3 w-3" />
                  Run
                </Button>
              </div>
            </div>

            <div className="flex-1 relative bg-white">
              <textarea
                ref={textareaRef}
                value={fileContent}
                onChange={(e) => {
                  setFileContent(e.target.value);
                  setIsSaved(false);
                }}
                onKeyDown={handleKeyDownEditor}
                className="w-full h-full p-4 font-mono text-xs text-slate-900 bg-white resize-none focus:outline-none leading-relaxed terminal-scroll selection:bg-pink-100"
                placeholder="Write or edit code here..."
                spellCheck={false}
              />
            </div>
          </Card>

          {/* Terminal Console */}
          <Card className="overflow-hidden bg-slate-950 border-slate-800 shadow-md">
            <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-slate-200">Terminal Output Console</span>
                {runOutput?.durationMs !== undefined && (
                  <Badge variant="success" className="text-[10px] font-mono py-0">
                    {runOutput.durationMs}ms • Exit {runOutput.exitCode}
                  </Badge>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRunOutput(null)}
                className="h-6 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 py-0 px-2"
              >
                Clear
              </Button>
            </div>

            <div className="p-3.5 font-mono text-xs max-h-48 overflow-y-auto leading-relaxed terminal-scroll bg-black/60 min-h-[120px]">
              {runOutput ? (
                <div className="space-y-2">
                  {runOutput.command && (
                    <div className="text-slate-400 text-[11px]">
                      $ {runOutput.command}
                    </div>
                  )}
                  {runOutput.stdout && (
                    <pre className="text-emerald-400 whitespace-pre-wrap">{runOutput.stdout}</pre>
                  )}
                  {runOutput.stderr && (
                    <pre className="text-rose-400 whitespace-pre-wrap">{runOutput.stderr}</pre>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 italic">
                  Press "Run File" to execute the active script or type a command below...
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>

            <form onSubmit={handleRunCustomCommand} className="p-2 bg-slate-900 border-t border-slate-800 flex gap-2">
              <span className="text-xs font-mono font-bold text-pink-500 self-center pl-1">$</span>
              <input
                type="text"
                placeholder="Run shell command (e.g. node -v, ls -la, python script.py)..."
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                className="flex-1 bg-transparent text-xs font-mono text-slate-100 focus:outline-none placeholder:text-slate-600"
              />
              <Button type="submit" isLoading={isRunning} size="sm" variant="success" className="h-7 text-xs px-2.5 font-bold">
                Execute
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* New File Modal */}
      <Modal
        isOpen={isNewFileModal}
        onClose={() => setIsNewFileModal(false)}
        title="Create New File"
        description="Enter filename with extension (e.g. server.js, app.py, worker.sh, Dockerfile)"
      >
        <form onSubmit={handleCreateFile} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Filename *</label>
            <Input
              placeholder="e.g. server.js, index.py, script.sh"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsNewFileModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success">
              Create File
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Directory Modal */}
      <Modal
        isOpen={isNewDirModal}
        onClose={() => setIsNewDirModal(false)}
        title="Create New Directory"
        description="Enter folder name to create in current workspace directory."
      >
        <form onSubmit={handleCreateDir} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Folder Name *</label>
            <Input
              placeholder="e.g. src, lib, scripts, tests"
              value={newDirName}
              onChange={(e) => setNewDirName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsNewDirModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success">
              Create Folder
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
