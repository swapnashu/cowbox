"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FolderCode, FileCode, Folder, FolderPlus, FilePlus, Play, Save, Trash2, Terminal, RefreshCw, Search, Sparkles, Copy, ChevronRight, Upload, FileText, Edit2, WrapText, X, GitBranch, Check, Loader2, PanelLeft, Download, Shield, ArrowUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatBytes } from "@/lib/utils";

interface FileItem { name: string; path: string; isDirectory: boolean; sizeBytes: number; extension: string; updatedAt: string; mode: string; modeCode: string; }
interface GitStatus { branch: string; files: { path: string; status: string; staged: boolean }[]; ahead: number; behind: number; isRepo: boolean; }
interface SearchResult { file: string; line: number; content: string; matchStart: number; matchEnd: number; }
interface Tab { id: string; filePath: string; name: string; content: string; savedContent: string; isModified: boolean; }
interface MeUser { id: string; email: string; name: string; role: string; }

const TEMPLATES: Record<string, { filename: string; content: string; icon: string }> = {
  express: { filename: "server.js", icon: "\u{1F7E2}", content: 'const http = require("http");\nconst s=http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"application/json"});r.end(JSON.stringify({msg:"Hello Cowbox!",t:new Date().toISOString()},null,2));});\nconst P=process.env.PORT||8080;s.listen(P,()=>console.log("Server on "+P));\n' },
  python: { filename: "app.py", icon: "\u{1F40D}", content: 'import json,sys,datetime\ndef main():\n    print(f"Python {sys.version.split()[0]}")\n    print(json.dumps({"status":"online","t":str(datetime.datetime.now())},indent=2))\n\nif __name__=="__main__":\n    main()\n' },
  shell: { filename: "audit.sh", icon: "\u{1F527}", content: '#!/usr/bin/env bash\necho "=== COWBOX AUDIT ==="\necho "Host: $(hostname)"\necho "Node: $(node -v 2>/dev/null || echo N/A)"\necho "Python: $(python -V 2>/dev/null || echo N/A)"\n' },
  docker: { filename: "Dockerfile", icon: "\u{1F433}", content: 'FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --ignore-scripts\nCOPY . .\nEXPOSE 8080\nCMD ["npm","start"]\n' },
  react: { filename: "Component.tsx", icon: "\u269B\uFE0F", content: 'import React from "react";\n\nexport default function Component() {\n  return (\n    <div className="p-4 border rounded-lg bg-white shadow-sm">\n      <h1 className="text-xl font-bold text-pink-600">Hello Cowbox</h1>\n    </div>\n  );\n}\n' },
  html: { filename: "index.html", icon: "\u{1F310}", content: '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>Cowbox</title></head>\n<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">\n  <div style="text-align:center"><h1>Cowbox Live</h1><p>Zero config deploy</p></div>\n</body>\n</html>\n' },
};

export default function FileManagerPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentDir, setCurrentDir] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("name");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [runOutput, setRunOutput] = useState<{ command?: string; stdout?: string; stderr?: string; exitCode?: number; durationMs?: number } | null>(null);
  const [customCommand, setCustomCommand] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [isGitPanelOpen, setIsGitPanelOpen] = useState(false);
  const [isGitLoading, setIsGitLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [isFilePanelCollapsed, setIsFilePanelCollapsed] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [isNewFileModal, setIsNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isNewDirModal, setIsNewDirModal] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [isRenameModal, setIsRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isDeleteModal, setIsDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [isChmodModal, setIsChmodModal] = useState(false);
  const [chmodTarget, setChmodTarget] = useState<FileItem | null>(null);
  const [chmodValue, setChmodValue] = useState("755");
  const [chmodBusy, setChmodBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [rootMode, setRootMode] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [isEditablePath, setIsEditablePath] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isAdmin = me?.role === "admin";

  const fetchFiles = useCallback(async (dir = "") => {
    try {
      const params = new URLSearchParams();
      if (dir) params.set("path", dir);
      if (rootMode) params.set("root", "1");
      const res = await fetch(`/api/files?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.items || []);
        setCurrentDir(data.currentPath || "");
        setPathInput(data.currentPath || "");
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [rootMode]);

  const navigateTo = useCallback((dir: string) => {
    setCurrentDir(dir);
    fetchFiles(dir);
  }, [fetchFiles]);

  const fetchGitStatus = useCallback(async () => {
    try {
      setIsGitLoading(true);
      const params = new URLSearchParams();
      if (currentDir) params.set("repo", currentDir);
      if (rootMode) params.set("root", "1");
      const res = await fetch(`/api/files/git?${params.toString()}`);
      if (res.ok) setGitStatus(await res.json());
    } catch { setGitStatus(null); } finally { setIsGitLoading(false); }
  }, [currentDir, rootMode]);

  const handleGlobalSearch = useCallback(async () => {
    if (!globalSearch.trim()) return; setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("q", globalSearch.trim());
      if (currentDir) params.set("dir", currentDir);
      if (rootMode) params.set("root", "1");
      const res = await fetch(`/api/files/search?${params.toString()}`);
      if (res.ok) { const data = await res.json(); setSearchResults(data.results || []); }
    } catch { setSearchResults([]); } finally { setIsSearching(false); }
  }, [globalSearch, currentDir, rootMode]);

  const openFile = useCallback(async (filePath: string) => {
    const existingTab = tabs.find((t) => t.filePath === filePath);
    if (existingTab) { setActiveTabId(existingTab.id); return; }
    setIsLoadingFile(true);
    try {
      const params = new URLSearchParams();
      params.set("path", filePath);
      if (rootMode) params.set("root", "1");
      const res = await fetch(`/api/files/read?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const newTab: Tab = { id: crypto.randomUUID(), filePath: data.path, name: data.name, content: data.content || "", savedContent: data.content || "", isModified: false };
        setTabs((prev) => [...prev, newTab]); setActiveTabId(newTab.id);
      }
    } catch (e) { console.error(e); } finally { setIsLoadingFile(false); }
  }, [tabs, rootMode]);

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, content, isModified: content !== t.savedContent } : t));
  }, []);

  const closeTab = useCallback((tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.isModified && !confirm(`Unsaved changes in ${tab.name}. Close anyway?`)) return;
    const next = tabs.filter((t) => t.id !== tabId);
    if (activeTabId === tabId) setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
    setTabs(next);
  }, [tabs, activeTabId]);

  const handleSave = useCallback(async () => {
    if (!activeTab) return; setIsSaving(true);
    try {
      const res = await fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filePath: activeTab.filePath, content: activeTab.content, root: rootMode }) });
      if (res.ok) { setTabs((prev) => prev.map((t) => t.id === activeTab.id ? { ...t, savedContent: t.content, isModified: false } : t)); fetchFiles(currentDir); }
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  }, [activeTab, currentDir, fetchFiles, rootMode]);

  const handleRun = useCallback(async () => {
    if (!activeTab) return; await handleSave(); setIsRunning(true);
    try { const res = await fetch("/api/files/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filePath: activeTab.filePath, root: rootMode }) }); setRunOutput(await res.json()); }
    catch (e: any) { setRunOutput({ stderr: e.message, exitCode: 1 }); } finally { setIsRunning(false); setIsTerminalOpen(true); }
  }, [activeTab, handleSave, rootMode]);

  const handleRunCommand = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); if (!customCommand.trim()) return; setIsRunning(true);
    try { const res = await fetch("/api/files/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: customCommand.trim() }) }); setRunOutput(await res.json()); setCustomCommand(""); }
    catch (e: any) { setRunOutput({ stderr: e.message, exitCode: 1 }); } finally { setIsRunning(false); }
  }, [customCommand]);

  const handleGitCommit = useCallback(async () => {
    if (!commitMessage.trim()) return;
    try { await fetch("/api/files/git", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "commit", message: commitMessage, dir: currentDir, root: rootMode }) }); setCommitMessage(""); fetchGitStatus(); }
    catch (e) { console.error(e); }
  }, [commitMessage, currentDir, fetchGitStatus, rootMode]);

  const handleGitStage = useCallback(async (filePath: string, staged: boolean) => {
    try { await fetch("/api/files/git", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: staged ? "unstage" : "stage", filePath, dir: currentDir, root: rootMode }) }); fetchGitStatus(); }
    catch (e) { console.error(e); }
  }, [fetchGitStatus, currentDir, rootMode]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const params = new URLSearchParams();
      params.set("path", deleteTarget.path);
      if (rootMode) params.set("root", "1");
      await fetch(`/api/files?${params.toString()}`, { method: "DELETE" });
      setTabs((prev) => prev.filter((t) => t.filePath !== deleteTarget.path));
      if (activeTab?.filePath === deleteTarget.path) setActiveTabId(null);
      setIsDeleteModal(false); setDeleteTarget(null); fetchFiles(currentDir);
    } catch (e) { console.error(e); }
  }, [deleteTarget, activeTab, currentDir, fetchFiles, rootMode]);

  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const lastSlash = renameTarget.path.lastIndexOf("/");
    const newPath = lastSlash >= 0 ? renameTarget.path.substring(0, lastSlash + 1) + renameValue.trim() : renameValue.trim();
    try {
      await fetch("/api/files", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldPath: renameTarget.path, newPath, root: rootMode }) });
      const rt = tabs.find((t) => t.filePath === renameTarget.path);
      if (rt) setTabs((prev) => prev.map((t) => t.id === rt.id ? { ...t, filePath: newPath, name: renameValue.trim() } : t));
      setIsRenameModal(false); setRenameTarget(null); fetchFiles(currentDir);
    } catch (e) { console.error(e); }
  }, [renameTarget, renameValue, currentDir, fetchFiles, tabs, rootMode]);

  const handleCopyFile = useCallback(async (file: FileItem) => {
    const newName = prompt(`Duplicate ${file.name} as:`, `copy_${file.name}`);
    if (!newName || newName === file.name) return;
    const lastSlash = file.path.lastIndexOf("/");
    const newPath = lastSlash >= 0 ? file.path.substring(0, lastSlash + 1) + newName : newName;
    try { await fetch("/api/files", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "copy", sourcePath: file.path, destPath: newPath, root: rootMode }) }); fetchFiles(currentDir); }
    catch (e) { console.error(e); }
  }, [rootMode, currentDir, fetchFiles]);

  const handleChmod = useCallback(async () => {
    if (!chmodTarget) return; setChmodBusy(true);
    try {
      const res = await fetch("/api/files", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chmod", path: chmodTarget.path, mode: chmodValue, root: rootMode }) });
      if (res.ok) { setIsChmodModal(false); setChmodTarget(null); fetchFiles(currentDir); }
    } catch (e) { console.error(e); } finally { setChmodBusy(false); }
  }, [chmodTarget, chmodValue, rootMode, currentDir, fetchFiles]);

  const handleCreateFile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); if (!newFileName.trim()) return;
    const fp = currentDir ? `${currentDir}/${newFileName.trim()}` : newFileName.trim();
    const res = await fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filePath: fp, content: "", root: rootMode }) });
    if (res.ok) { setIsNewFileModal(false); setNewFileName(""); fetchFiles(currentDir); openFile(fp); }
  }, [newFileName, currentDir, fetchFiles, openFile, rootMode]);

  const handleCreateDir = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); if (!newDirName.trim()) return;
    const fp = currentDir ? `${currentDir}/${newDirName.trim()}` : newDirName.trim();
    const res = await fetch("/api/files/mkdir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dirPath: fp, root: rootMode }) });
    if (res.ok) { setIsNewDirModal(false); setNewDirName(""); fetchFiles(currentDir); }
  }, [newDirName, currentDir, fetchFiles, rootMode]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file); fd.append("targetDir", currentDir);
    if (rootMode) fd.append("root", "1");
    const res = await fetch("/api/files/upload", { method: "POST", body: fd });
    if (res.ok) { fetchFiles(currentDir); openFile(currentDir ? `${currentDir}/${file.name}` : file.name); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [currentDir, fetchFiles, openFile, rootMode]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    for (const file of Array.from(e.dataTransfer.files)) {
      const fd = new FormData(); fd.append("file", file); fd.append("targetDir", currentDir);
      if (rootMode) fd.append("root", "1");
      await fetch("/api/files/upload", { method: "POST", body: fd });
    }
    fetchFiles(currentDir);
  }, [currentDir, fetchFiles, rootMode]);

  const handleTemplate = useCallback(async (key: string) => {
    const t = TEMPLATES[key]; if (!t) return;
    const fp = currentDir ? `${currentDir}/${t.filename}` : t.filename;
    await fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filePath: fp, content: t.content, root: rootMode }) });
    fetchFiles(currentDir); openFile(fp);
  }, [currentDir, fetchFiles, openFile, rootMode]);

  const handleDownload = useCallback((file?: FileItem) => {
    const target = file || (activeTab ? { path: activeTab.filePath, name: activeTab.name } : null);
    if (!target) return;
    const params = new URLSearchParams();
    params.set("path", target.path);
    params.set("download", "1");
    if (rootMode) params.set("root", "1");
    window.open(`/api/files/raw?${params.toString()}`, "_blank");
  }, [activeTab, rootMode]);

  const handleToggleRoot = useCallback(() => {
    if (!isAdmin) return;
    const next = !rootMode;
    setRootMode(next);
    setCurrentDir("");
    setIsLoading(true);
  }, [rootMode, isAdmin]);

  const handleGoUp = useCallback(() => {
    if (!currentDir) return;
    if (!rootMode) {
      const parts = currentDir.split("/").filter(Boolean);
      parts.pop();
      navigateTo(parts.join("/"));
      return;
    }
// Root mode: go up to parent directory. At the drive root, jump to drive list.
    let norm = currentDir.replace(/\\/g, "/");
    const driveRootMatch = norm.match(/^([a-zA-Z]:)([\\/].*)?$/);
    if (driveRootMatch && !driveRootMatch[2]) {
      // e.g. "C:" -> drive root "C:/"
      norm = `${driveRootMatch[1]}/`;
    }
    if (/^[a-zA-Z]:\/?$/.test(norm)) {
      // at a drive root -> show drive list
      navigateTo("");
      return;
    }
    const idx = norm.lastIndexOf("/");
    if (idx <= 0) { navigateTo(""); return; }
    const parent = norm.substring(0, idx);
    // If parent is exactly a drive letter, send as "C:/" (drive root)
    navigateTo(/^[a-zA-Z]:$/.test(parent) ? `${parent}/` : parent);
  }, [currentDir, rootMode, navigateTo]);

  const handlePathJump = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pathInput.trim();
    if (!trimmed) { navigateTo(""); return; }
    navigateTo(trimmed);
    setIsEditablePath(false);
  }, [pathInput, navigateTo]);

  const handleOpenChmod = useCallback((file: FileItem) => {
    setChmodTarget(file); setChmodValue(file.modeCode || (file.isDirectory ? "755" : "644")); setIsChmodModal(true);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => (r.ok ? r.json() : { user: null })).then((d) => setMe(d.user || null)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); setIsSearchPanelOpen((v) => !v); }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); setIsFilePanelCollapsed((v) => !v); }
      if (e.key === "F2" && activeTab) { const file = files.find((f) => f.path === activeTab.filePath); if (file) { setRenameTarget(file); setRenameValue(file.name); setIsRenameModal(true); } }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [handleSave, activeTab, files]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  useEffect(() => { fetchGitStatus(); }, [fetchGitStatus]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1; if (!a.isDirectory && b.isDirectory) return 1;
      if (sortBy === "size") return b.sizeBytes - a.sizeBytes;
      if (sortBy === "date") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return a.name.localeCompare(b.name);
    });
  }, [files, search, sortBy]);

  const breadcrumbParts = useMemo(() => {
    if (!currentDir) return [];
    if (!rootMode) return currentDir.split("/").filter(Boolean);
    const norm = currentDir.replace(/\\/g, "/");
    return norm.split("/").filter(Boolean);
  }, [currentDir, rootMode]);

  const getFileIcon = (ext: string, isDir: boolean) => {
    if (isDir) return <Folder className="h-4 w-4 text-pink-500 fill-pink-500/20" />;
    switch (ext) {
      case "js": case "mjs": case "ts": case "tsx": case "jsx": return <FileCode className="h-4 w-4 text-amber-500" />;
      case "py": return <FileCode className="h-4 w-4 text-emerald-600" />;
      case "sh": case "bash": return <Terminal className="h-4 w-4 text-emerald-500" />;
      case "json": case "yaml": case "yml": case "toml": return <FileCode className="h-4 w-4 text-rose-500" />;
      case "png": case "jpg": case "jpeg": case "gif": case "svg": case "webp": return <Sparkles className="h-4 w-4 text-purple-500" />;
      case "md": case "txt": return <FileText className="h-4 w-4 text-slate-500" />;
      case "html": case "css": case "scss": return <FileCode className="h-4 w-4 text-blue-500" />;
      default: return <FileCode className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col overflow-hidden" onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
      {dragOver && (<div className="fixed inset-0 z-50 bg-pink-500/10 backdrop-blur-sm border-2 border-dashed border-pink-400 flex items-center justify-center pointer-events-none"><div className="bg-white rounded-2xl px-8 py-6 shadow-xl border border-pink-200 flex items-center gap-3"><Upload className="h-6 w-6 text-pink-500" /><span className="text-lg font-bold text-slate-800">Drop files to upload</span></div></div>)}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white/80 shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FolderCode className="h-5 w-5 text-pink-600 shrink-0" />
          <h1 className="text-sm font-bold text-slate-900 shrink-0">File Manager</h1>
          {isAdmin && (
            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer text-[11px] font-semibold">
              <input type="checkbox" checked={rootMode} onChange={handleToggleRoot} className="accent-pink-500 h-3.5 w-3.5" />
              <Shield className={`h-3.5 w-3.5 ${rootMode ? "text-pink-600" : "text-slate-400"}`} />
              <span className={rootMode ? "text-pink-700" : "text-slate-500"}>Filesystem</span>
            </label>
          )}
          <div className="h-4 w-px bg-slate-200 shrink-0" />
          {isEditablePath ? (
            <form onSubmit={handlePathJump} className="flex items-center gap-1 min-w-0 flex-1">
              <input autoFocus value={pathInput} onChange={(e) => setPathInput(e.target.value)} onBlur={() => setIsEditablePath(false)} placeholder={rootMode ? "C:/Users/name/..." : "folder/subfolder"} className="flex-1 min-w-0 h-6 rounded-md border border-pink-200 bg-white px-2 text-[11px] font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-300 text-left" />
              <Button type="submit" size="sm" className="h-6 px-2 text-[11px]">Go</Button>
            </form>
          ) : (
            <div className="flex items-center gap-0.5 text-[11px] text-slate-500 font-mono min-w-0 flex-1 overflow-hidden whitespace-nowrap" onClick={() => { setPathInput(currentDir); setIsEditablePath(true); }}>
              <button onClick={(e) => { e.stopPropagation(); setCurrentDir(""); fetchFiles(""); setIsEditablePath(false); }} className="cursor-pointer hover:text-pink-600 px-1 shrink-0">{"root"}</button>
              {breadcrumbParts.map((part, i) => {
                const isDrive = rootMode && /^[a-zA-Z]:$/.test(part);
                const psParts = breadcrumbParts.slice(0, i + 1);
                if (isDrive) psParts[i] = `${part}/`;
                const ps = psParts.join("/");
                return (<span key={`${ps}_${i}`} className="flex items-center gap-0.5 shrink-0"><ChevronRight className="h-3 w-3 text-slate-300" /><span onClick={(e) => { e.stopPropagation(); navigateTo(ps); setIsEditablePath(false); }} className="cursor-pointer hover:text-pink-600 px-1">{part}</span></span>);
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleGoUp} title="Up one level"><ArrowUp className="h-3.5 w-3.5" /></Button>
          <div className="hidden md:flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200 text-[11px] mr-2">
            {Object.entries(TEMPLATES).map(([key, val]) => (<button key={key} onClick={() => handleTemplate(key)} className="px-2 py-1 hover:bg-pink-50 hover:text-pink-600 rounded font-medium transition-colors">{val.icon} {val.filename}</button>))}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSearchPanelOpen((v) => !v)}><Search className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsGitPanelOpen((v) => !v)}><GitBranch className="h-3.5 w-3.5" /></Button>
          <div className="h-4 w-px bg-slate-200" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsFilePanelCollapsed((v) => !v)}><PanelLeft className="h-3.5 w-3.5" /></Button>
          <label className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-pink-600 cursor-pointer"><input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" /><Upload className="h-3.5 w-3.5" /></label>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsNewFileModal(true)}><FilePlus className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsNewDirModal(true)}><FolderPlus className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchFiles(currentDir)}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        {!isFilePanelCollapsed && (
          <div className="w-80 flex flex-col border-r border-slate-200 bg-white shrink-0">
            <div className="p-2 border-b border-slate-100 flex flex-col gap-2">
              <div className="relative"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" /><Input placeholder="Filter..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs bg-slate-50 border-slate-200" /></div>
              <div className="flex items-center gap-1"><select value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "size" | "date")} className="h-7 flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md px-2 focus:outline-none"><option value="name">Name</option><option value="size">Size</option><option value="date">Date</option></select><span className="text-[10px] text-slate-400 font-mono">{filteredFiles.length}</span></div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {isLoading ? (<div className="p-8 text-center text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />Loading...</div>) : filteredFiles.length === 0 ? (<div className="p-8 text-center text-xs text-slate-400">No files</div>) : (
                filteredFiles.map((file) => (
                  <div key={file.path} onClick={() => file.isDirectory ? navigateTo(file.path) : openFile(file.path)} className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all group ${activeTab?.filePath === file.path ? "bg-pink-50 text-pink-700 font-bold border border-pink-200/80" : "text-slate-700 hover:bg-slate-100/70"}`}>
                    <div className="flex items-center gap-2 truncate min-w-0 flex-1">{getFileIcon(file.extension, file.isDirectory)}<span className="truncate">{file.name}</span></div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!file.isDirectory && <span className="text-[10px] text-slate-400 font-mono hidden lg:inline">{formatBytes(file.sizeBytes, 0)}</span>}
                      {rootMode && <span className="text-[9px] text-slate-400 font-mono hidden xl:inline border border-slate-200 rounded px-0.5">{file.modeCode}</span>}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!file.isDirectory && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} className="p-0.5 rounded text-slate-400 hover:text-sky-600" title="Download"><Download className="h-3 w-3" /></button>
                          </>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleCopyFile(file); }} className="p-0.5 rounded text-slate-400 hover:text-emerald-600"><Copy className="h-3 w-3" /></button>
                        {rootMode && <button onClick={(e) => { e.stopPropagation(); handleOpenChmod(file); }} className="p-0.5 rounded text-slate-400 hover:text-orange-600" title="Permissions"><Lock className="h-3 w-3" /></button>}
                        <button onClick={(e) => { e.stopPropagation(); setRenameTarget(file); setRenameValue(file.name); setIsRenameModal(true); }} className="p-0.5 rounded text-slate-400 hover:text-blue-600"><Edit2 className="h-3 w-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); setIsDeleteModal(true); }} className="p-0.5 rounded text-slate-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0">
          {tabs.length > 0 && (
            <div className="flex items-center bg-slate-50 border-b border-slate-200 overflow-x-auto shrink-0">
              {tabs.map((tab) => (
                <div key={tab.id} onClick={() => setActiveTabId(tab.id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border-r border-slate-200 cursor-pointer shrink-0 ${activeTabId === tab.id ? "bg-white text-pink-700 font-bold" : "text-slate-500 hover:bg-slate-100"}`}>
                  <span className="max-w-[140px] truncate">{tab.name}</span>
                  {tab.isModified && <span className="h-2 w-2 rounded-full bg-pink-500 shrink-0" />}
                  <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 flex flex-col min-h-0">
            {activeTab ? (
              <>
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0">
                  <div className="flex items-center gap-2 min-w-0"><span className="font-mono text-xs text-slate-700 truncate">{activeTab.filePath}</span>{!activeTab.isModified && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setWordWrap(!wordWrap)}><WrapText className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleDownload()}><Download className="h-3 w-3" /></Button>
                    <span className="text-[10px] font-mono text-slate-400 ml-2">{activeTab.content.split("\n").length} lines</span>
                    <Button onClick={handleSave} isLoading={isSaving} size="sm" variant="outline" className="h-6 text-[11px] px-2 ml-1"><Save className="h-3 w-3" />Save</Button>
                    <Button onClick={handleRun} isLoading={isRunning} size="sm" variant="success" className="h-6 text-[11px] px-2"><Play className="h-3 w-3" />Run</Button>
                  </div>
                </div>
                <textarea ref={textareaRef} value={activeTab.content} onChange={(e) => updateTabContent(activeTab.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; const end = t.selectionEnd; const nv = activeTab.content.substring(0, s) + "  " + activeTab.content.substring(end); updateTabContent(activeTab.id, nv); setTimeout(() => { t.selectionStart = t.selectionEnd = s + 2; }, 0); } }} className={`flex-1 w-full p-4 font-mono text-xs text-slate-900 bg-white resize-none focus:outline-none leading-relaxed ${wordWrap ? "whitespace-pre-wrap" : "whitespace-pre"}`} spellCheck={false} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a file to edit</div>
            )}
          </div>
          {isTerminalOpen && (
            <div className="h-48 bg-slate-950 border-t border-slate-800 flex flex-col shrink-0">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5 text-emerald-400" /><span className="text-xs font-mono font-bold text-slate-200">Terminal</span>{runOutput?.durationMs !== undefined && <Badge variant="success" className="text-[10px] font-mono py-0">{runOutput.durationMs}ms</Badge>}</div>
                <Button variant="ghost" size="sm" onClick={() => setRunOutput(null)} className="h-5 text-[10px] text-slate-400 hover:text-white py-0 px-2">Clear</Button>
              </div>
              <div className="flex-1 p-3 font-mono text-xs overflow-y-auto text-slate-300">
                {runOutput ? (<>
                  {runOutput.command && <div className="text-slate-400">$ {runOutput.command}</div>}
                  {runOutput.stdout && <pre className="text-emerald-400 whitespace-pre-wrap">{runOutput.stdout}</pre>}
                  {runOutput.stderr && <pre className="text-rose-400 whitespace-pre-wrap">{runOutput.stderr}</pre>}
                </>) : <div className="text-slate-500 italic">Press Run or type a command...</div>}
              </div>
              <form onSubmit={handleRunCommand} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-t border-slate-800">
                <span className="text-xs font-mono font-bold text-pink-500">$</span>
                <input type="text" value={customCommand} onChange={(e) => setCustomCommand(e.target.value)} placeholder="Run command..." className="flex-1 bg-transparent text-xs font-mono text-slate-100 focus:outline-none placeholder:text-slate-600" />
                <Button type="submit" isLoading={isRunning} size="sm" variant="success" className="h-6 text-[11px] px-2">Execute</Button>
              </form>
            </div>
          )}
        </div>
      </div>
      {isSearchPanelOpen && (
        <div className="absolute top-12 right-4 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-40 p-4">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-slate-800">Search Files</h3><button onClick={() => setIsSearchPanelOpen(false)}><X className="h-4 w-4 text-slate-400" /></button></div>
          <div className="flex gap-2 mb-3"><Input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleGlobalSearch(); }} placeholder="Search content..." className="h-8 text-xs" /><Button onClick={handleGlobalSearch} isLoading={isSearching} size="sm" className="h-8 text-xs"><Search className="h-3 w-3" /></Button></div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {searchResults.map((r, i) => (<div key={i} onClick={() => { openFile(r.file); setIsSearchPanelOpen(false); }} className="p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs border border-slate-100"><div className="font-mono text-pink-600">{r.file}:{r.line}</div><div className="text-slate-600 mt-0.5 truncate font-mono">{r.content}</div></div>))}
          </div>
        </div>
      )}
      {isGitPanelOpen && (
        <div className="absolute top-12 right-4 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-40 p-4">
          <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><GitBranch className="h-4 w-4 text-pink-500" />Git</h3><button onClick={() => setIsGitPanelOpen(false)}><X className="h-4 w-4 text-slate-400" /></button></div>
          {isGitLoading ? <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Loading...</div> : gitStatus?.isRepo ? (
            <div className="space-y-3">
              <div className="text-xs font-mono text-slate-600">Branch: <span className="text-pink-600 font-bold">{gitStatus.branch}</span></div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {gitStatus.files.map((f, i) => (<div key={i} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-50"><div className="flex items-center gap-2 font-mono"><Badge variant={f.staged ? "success" : "secondary"} className="text-[9px] py-0">{f.status}</Badge><span className="text-slate-700 truncate max-w-48">{f.path}</span></div><Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => handleGitStage(f.path, f.staged)}>{f.staged ? "Unstage" : "Stage"}</Button></div>))}
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100"><Input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Commit message..." className="h-8 text-xs" /><Button onClick={handleGitCommit} size="sm" className="h-8 text-xs">Commit</Button></div>
            </div>
          ) : <div className="text-xs text-slate-400">Not a git repository</div>}
        </div>
      )}
      <Modal isOpen={isNewFileModal} onClose={() => setIsNewFileModal(false)} title="New File" description="Enter filename with extension"><form onSubmit={handleCreateFile} className="space-y-4"><Input placeholder="server.js" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} required autoFocus /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsNewFileModal(false)}>Cancel</Button><Button type="submit" variant="success">Create</Button></div></form></Modal>
      <Modal isOpen={isNewDirModal} onClose={() => setIsNewDirModal(false)} title="New Directory" description="Enter folder name"><form onSubmit={handleCreateDir} className="space-y-4"><Input placeholder="src" value={newDirName} onChange={(e) => setNewDirName(e.target.value)} required autoFocus /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsNewDirModal(false)}>Cancel</Button><Button type="submit" variant="success">Create</Button></div></form></Modal>
      <Modal isOpen={isRenameModal} onClose={() => setIsRenameModal(false)} title="Rename" description="Enter new name"><form onSubmit={(e) => { e.preventDefault(); handleRename(); }} className="space-y-4"><Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} required autoFocus /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsRenameModal(false)}>Cancel</Button><Button type="submit" variant="success">Rename</Button></div></form></Modal>
      <Modal isOpen={isDeleteModal} onClose={() => setIsDeleteModal(false)} title="Delete" description={rootMode && deleteTarget?.isDirectory ? `Permanently delete directory ${deleteTarget?.name} and ALL contents? This cannot be undone.` : `Delete ${deleteTarget?.name}?`}><div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={() => setIsDeleteModal(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></div></Modal>
      <Modal isOpen={isChmodModal} onClose={() => setIsChmodModal(false)} title="Change Permissions" description={`Set permissions for ${chmodTarget?.name || ""} (octal, e.g. 755)`} maxWidth="sm"><div className="space-y-4">
        <div className="flex gap-2">
          {["755", "644", "700", "600", "777", "750"].map((m) => (<button key={m} type="button" onClick={() => setChmodValue(m)} className={`flex-1 py-2 rounded-lg border text-[11px] font-mono font-bold transition-colors ${chmodValue === m ? "bg-pink-50 border-pink-300 text-pink-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{m}</button>))}
        </div>
        <Input value={chmodValue} onChange={(e) => setChmodValue(e.target.value.replace(/[^0-7]/g, "").slice(0, 4))} placeholder="755" inputMode="numeric" autoFocus />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsChmodModal(false)}>Cancel</Button><Button isLoading={chmodBusy} variant="success" onClick={handleChmod}><Lock className="h-3 w-3" />Apply</Button></div>
      </div></Modal>
    </div>
  );
}