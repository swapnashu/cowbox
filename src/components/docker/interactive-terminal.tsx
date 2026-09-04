"use client";

import { useState, useRef, useEffect } from "react";
import {
  Terminal as TerminalIcon,
  Play,
  Trash2,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  Zap,
  CornerDownLeft,
  ChevronRight,
  Shield,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TerminalHistoryItem {
  id: string;
  command: string;
  output: string;
  exitCode?: number;
  success: boolean;
  timestamp: string;
}

const QUICK_COMMANDS = [
  { label: "List Files", cmd: "ls -la" },
  { label: "Processes", cmd: "ps aux 2>/dev/null || ps" },
  { label: "Disk Space", cmd: "df -h" },
  { label: "Environment", cmd: "env" },
  { label: "OS Version", cmd: "cat /etc/os-release 2>/dev/null || uname -a" },
  { label: "Uptime", cmd: "uptime" },
  { label: "Node.js", cmd: "node -v" },
  { label: "Python", cmd: "python -V 2>/dev/null || python3 -V" },
];

export function InteractiveTerminal({
  containerId,
  containerName,
  initialHistory = [],
}: {
  containerId: string;
  containerName?: string;
  initialHistory?: TerminalHistoryItem[];
}) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<TerminalHistoryItem[]>(initialHistory);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistoryIndex, setCommandHistoryIndex] = useState<number>(-1);
  const [pastCommands, setPastCommands] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isExecuting]);

  const executeCommand = async (cmdToRun: string) => {
    if (!cmdToRun.trim() || isExecuting || !containerId) return;

    const trimmedCmd = cmdToRun.trim();
    setIsExecuting(true);
    setPastCommands((prev) => [...prev, trimmedCmd]);
    setCommandHistoryIndex(-1);
    setCommand("");

    const timestamp = new Date().toLocaleTimeString();

    try {
      const res = await fetch(`/api/containers/${containerId}/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmedCmd }),
      });

      const data = await res.json();

      setHistory((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          command: trimmedCmd,
          output: data.output || data.error || (data.success ? "Command executed with no output." : "Execution failed"),
          exitCode: data.exitCode ?? (data.success ? 0 : 1),
          success: data.success !== false,
          timestamp,
        },
      ]);
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          command: trimmedCmd,
          output: `Network / Execution Error: ${err.message}`,
          exitCode: 1,
          success: false,
          timestamp,
        },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCommand(command);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (pastCommands.length === 0) return;
      const nextIndex =
        commandHistoryIndex === -1
          ? pastCommands.length - 1
          : Math.max(0, commandHistoryIndex - 1);
      setCommandHistoryIndex(nextIndex);
      setCommand(pastCommands[nextIndex] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (commandHistoryIndex === -1) return;
      const nextIndex = commandHistoryIndex + 1;
      if (nextIndex >= pastCommands.length) {
        setCommandHistoryIndex(-1);
        setCommand("");
      } else {
        setCommandHistoryIndex(nextIndex);
        setCommand(pastCommands[nextIndex] || "");
      }
    }
  };

  const handleCopyLogs = () => {
    const text = history
      .map((h) => `$ ${h.command}\n${h.output}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setHistory([]);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl text-slate-100 font-mono text-xs">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-rose-500/80"></div>
            <div className="h-3 w-3 rounded-full bg-amber-500/80"></div>
            <div className="h-3 w-3 rounded-full bg-emerald-500/80"></div>
          </div>
          <span className="text-slate-400 font-sans text-xs font-semibold ml-2 flex items-center gap-1.5">
            <TerminalIcon className="h-3.5 w-3.5 text-pink-400" />
            {containerName || containerId.substring(0, 12)} &mdash; Interactive PTY Shell
          </span>
        </div>

        <div className="flex items-center gap-2 font-sans">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLogs}
            className="h-7 text-[11px] border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            {copied ? <Check className="h-3 w-3 mr-1 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied" : "Copy Output"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            className="h-7 text-[11px] border-slate-700 bg-slate-800 text-slate-300 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-800"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 font-sans text-[11px]">
        <span className="text-slate-400 text-xs flex items-center gap-1 mr-1">
          <Zap className="h-3 w-3 text-amber-400" />
          Quick:
        </span>
        {QUICK_COMMANDS.map((qc) => (
          <button
            key={qc.label}
            onClick={() => executeCommand(qc.cmd)}
            disabled={isExecuting}
            className="px-2 py-0.5 rounded-md bg-slate-800/90 hover:bg-pink-950/80 hover:text-pink-300 hover:border-pink-800/60 border border-slate-700 text-slate-300 transition-colors disabled:opacity-50"
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* Terminal Screen */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[500px] min-h-[320px] select-text">
        {history.length === 0 ? (
          <div className="text-slate-500 py-8 text-center font-sans text-xs">
            <TerminalIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Connected to container shell session ({containerId.substring(0, 12)}). Type a command below or click a quick action.
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="space-y-1.5 animate-in fade-in duration-100">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-pink-400">
                  <ChevronRight className="h-3.5 w-3.5 text-pink-500" />
                  <span>{item.command}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600">{item.timestamp}</span>
                  <Badge
                    className={`text-[10px] px-1.5 py-0 h-4 font-mono ${
                      item.success
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    exit {item.exitCode}
                  </Badge>
                </div>
              </div>
              <pre className="p-2.5 rounded-lg bg-slate-900/90 text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed text-[11.5px] border border-slate-800/60">
                {item.output}
              </pre>
            </div>
          ))
        )}

        {isExecuting && (
          <div className="flex items-center gap-2 text-pink-400 text-xs animate-pulse">
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
            Executing command in container...
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Input Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold pl-2 select-none">
          <span>root@container:~$</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command (e.g. ls -la, cat package.json, top)..."
          disabled={isExecuting}
          className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none font-mono text-xs px-2 py-1.5"
          autoFocus
        />
        <Button
          size="sm"
          onClick={() => executeCommand(command)}
          disabled={isExecuting || !command.trim()}
          className="bg-pink-600 hover:bg-pink-500 text-white font-sans text-xs px-3 h-8 shadow-md shadow-pink-600/20"
        >
          <Play className="h-3 w-3 mr-1" />
          Run
        </Button>
      </div>
    </div>
  );
}
