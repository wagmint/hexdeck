"use client";

import { useState } from "react";
import type { TurnNode } from "@/lib/types";
import {
  X,
  MessageSquare,
  Bot,
  Wrench,
  FileCode,
  FileSearch,
  GitCommit,
  AlertTriangle,
  Layers,
  Terminal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface NodePanelProps {
  turn: TurnNode;
  onClose: () => void;
}

export function NodePanel({ turn, onClose }: NodePanelProps) {
  const totalTools = Object.values(turn.toolCounts).reduce((a, b) => a + b, 0);

  // Build compact tool summary: "Bash x23, Read x12, Edit x8"
  const toolSummary = Object.entries(turn.toolCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count]) => `${tool} x${count}`)
    .join(", ");

  return (
    <div className="fixed right-0 top-[53px] bottom-0 w-[400px] bg-card border-l border-border overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            Turn #{turn.index}
          </span>
          {turn.hasCommit && (
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
          )}
          {turn.hasCompaction && (
            <Layers className="w-3.5 h-3.5 text-yellow-400" />
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Compact stats bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {totalTools > 0 && (
            <span className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              {totalTools} tools
            </span>
          )}
          {turn.filesChanged.length > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <FileCode className="w-3 h-3" />
              {turn.filesChanged.length} changed
            </span>
          )}
          {turn.filesRead.length > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <FileSearch className="w-3 h-3" />
              {turn.filesRead.length} read
            </span>
          )}
          {turn.commands.length > 0 && (
            <span className="flex items-center gap-1 text-orange-400">
              <Terminal className="w-3 h-3" />
              {turn.commands.length} cmds
            </span>
          )}
          {turn.errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {turn.errorCount} {turn.errorCount === 1 ? "error" : "errors"}
            </span>
          )}
        </div>

        {/* User Instruction */}
        <Section icon={<MessageSquare className="w-3.5 h-3.5 text-primary" />} title="User">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {turn.userInstruction || "(continuation)"}
          </p>
        </Section>

        {/* Assistant Preview */}
        {turn.assistantPreview && (
          <Section icon={<Bot className="w-3.5 h-3.5 text-accent" />} title="Agent">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {turn.assistantPreview}...
            </p>
          </Section>
        )}

        {/* Commit — always visible if present */}
        {turn.hasCommit && turn.commitMessage && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-emerald-400/5 rounded border border-emerald-400/20">
            <GitCommit className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono text-xs text-emerald-400/80 truncate">
              {turn.commitMessage}
            </span>
          </div>
        )}

        {/* Compaction — always visible if present */}
        {turn.hasCompaction && turn.compactionText && (
          <div className="px-2 py-1.5 bg-yellow-400/5 rounded border border-yellow-400/20">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">Compaction</span>
            </div>
            <p className="text-xs text-yellow-400/70 leading-relaxed">
              {turn.compactionText.slice(0, 300)}
              {turn.compactionText.length > 300 && "..."}
            </p>
          </div>
        )}

        {/* Collapsible details */}
        {totalTools > 0 && (
          <CollapsibleSection title={`Tools: ${toolSummary}`}>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(turn.toolCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([tool, count]) => (
                  <span
                    key={tool}
                    className="font-mono text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded"
                  >
                    {tool}
                    {count > 1 && (
                      <span className="text-muted-foreground ml-1">x{count}</span>
                    )}
                  </span>
                ))}
            </div>
          </CollapsibleSection>
        )}

        {turn.filesChanged.length > 0 && (
          <CollapsibleSection title={`${turn.filesChanged.length} files changed`}>
            <div className="space-y-1">
              {turn.filesChanged.map((f) => (
                <div key={f} className="font-mono text-xs text-muted-foreground truncate">
                  {f}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {turn.filesRead.length > 0 && (
          <CollapsibleSection title={`${turn.filesRead.length} files read`}>
            <div className="space-y-1">
              {turn.filesRead.map((f) => (
                <div key={f} className="font-mono text-xs text-muted-foreground truncate">
                  {f}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {turn.commands.length > 0 && (
          <CollapsibleSection title={`${turn.commands.length} commands`}>
            <div className="space-y-1.5">
              {turn.commands.map((cmd, i) => (
                <div
                  key={i}
                  className="font-mono text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded break-all"
                >
                  {cmd.length > 200 ? cmd.slice(0, 200) + "..." : cmd}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* JSONL position */}
        <div className="pt-2 border-t border-border">
          <span className="font-mono text-[10px] text-muted-foreground">
            JSONL lines {turn.startLine}–{turn.endLine}
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border/50 pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        <span className="truncate">{title}</span>
      </button>
      {open && <div className="mt-2 pl-5">{children}</div>}
    </div>
  );
}
