"use client";

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
} from "lucide-react";

interface NodePanelProps {
  turn: TurnNode;
  onClose: () => void;
}

export function NodePanel({ turn, onClose }: NodePanelProps) {
  const totalTools = Object.values(turn.toolCounts).reduce((a, b) => a + b, 0);

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
          {turn.hasError && (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
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

      <div className="p-4 space-y-5">
        {/* User Instruction */}
        <Section icon={<MessageSquare className="w-3.5 h-3.5 text-primary" />} title="User Instruction">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {turn.userInstruction || "(no text — tool results / continuation)"}
          </p>
        </Section>

        {/* Assistant Preview */}
        {turn.assistantPreview && (
          <Section icon={<Bot className="w-3.5 h-3.5 text-accent" />} title="Assistant Response">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {turn.assistantPreview}...
            </p>
          </Section>
        )}

        {/* Tool Usage */}
        {totalTools > 0 && (
          <Section icon={<Wrench className="w-3.5 h-3.5 text-muted-foreground" />} title={`Tools (${totalTools})`}>
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
          </Section>
        )}

        {/* Files Changed */}
        {turn.filesChanged.length > 0 && (
          <Section
            icon={<FileCode className="w-3.5 h-3.5 text-emerald-400" />}
            title={`Files Changed (${turn.filesChanged.length})`}
          >
            <div className="space-y-1">
              {turn.filesChanged.map((f) => (
                <div key={f} className="font-mono text-xs text-muted-foreground truncate">
                  {f}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Files Read */}
        {turn.filesRead.length > 0 && (
          <Section
            icon={<FileSearch className="w-3.5 h-3.5 text-blue-400" />}
            title={`Files Read (${turn.filesRead.length})`}
          >
            <div className="space-y-1">
              {turn.filesRead.map((f) => (
                <div key={f} className="font-mono text-xs text-muted-foreground truncate">
                  {f}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Commit */}
        {turn.hasCommit && turn.commitMessage && (
          <Section icon={<GitCommit className="w-3.5 h-3.5 text-emerald-400" />} title="Commit">
            <p className="font-mono text-sm text-emerald-400/80">
              &quot;{turn.commitMessage}&quot;
            </p>
          </Section>
        )}

        {/* Compaction */}
        {turn.hasCompaction && turn.compactionText && (
          <Section icon={<Layers className="w-3.5 h-3.5 text-yellow-400" />} title="Compaction Summary">
            <p className="text-sm text-yellow-400/70 leading-relaxed">
              {turn.compactionText.slice(0, 500)}
              {turn.compactionText.length > 500 && "..."}
            </p>
          </Section>
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
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
