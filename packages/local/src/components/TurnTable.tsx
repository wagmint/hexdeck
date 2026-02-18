"use client";

import { useMemo } from "react";
import type { TurnNode, TurnCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  GitCommit,
  Layers,
  HelpCircle,
  MessageCircle,
  Terminal,
  Zap,
  ArrowRight,
  Pause,
  Share2,
  AlertTriangle,
} from "lucide-react";

// ─── Category config ────────────────────────────────────────────────────────

const categoryConfig: Record<TurnCategory, { icon: typeof MessageSquare; color: string; bg: string; label: string }> = {
  task:          { icon: Zap,            color: "text-primary",          bg: "bg-primary/10",          label: "Task" },
  question:      { icon: HelpCircle,     color: "text-blue-400",         bg: "bg-blue-400/10",         label: "Question" },
  feedback:      { icon: MessageCircle,  color: "text-orange-400",       bg: "bg-orange-400/10",       label: "Feedback" },
  command:       { icon: Terminal,        color: "text-purple-400",       bg: "bg-purple-400/10",       label: "Command" },
  continuation:  { icon: ArrowRight,     color: "text-muted-foreground", bg: "bg-secondary/50",        label: "Continue" },
  interruption:  { icon: Pause,          color: "text-muted-foreground", bg: "bg-secondary/50",        label: "Interrupted" },
  context:       { icon: Share2,         color: "text-muted-foreground", bg: "bg-secondary/50",        label: "Context" },
  system:        { icon: Terminal,        color: "text-muted-foreground", bg: "bg-secondary/50",        label: "System" },
  conversation:  { icon: MessageSquare,  color: "text-cyan-400",         bg: "bg-cyan-400/10",         label: "Chat" },
};

// ─── Significance filter ────────────────────────────────────────────────────

function isSignificantTurn(turn: TurnNode): boolean {
  const totalTools = Object.values(turn.toolCounts).reduce((a, b) => a + b, 0);
  if (totalTools > 0 || turn.filesChanged.length > 0 || turn.hasCommit || turn.hasCompaction) return true;
  if (turn.category === "interruption" || turn.category === "system") return false;
  if (turn.category === "continuation" && !turn.userInstruction.trim()) return false;
  return true;
}

// ─── TurnTable ──────────────────────────────────────────────────────────────

interface TurnTableProps {
  turns: TurnNode[];
  selectedTurnId: string | null;
  onSelectTurn: (turn: TurnNode) => void;
}

export function TurnTable({ turns, selectedTurnId, onSelectTurn }: TurnTableProps) {
  const significantTurns = useMemo(() => turns.filter(isSignificantTurn), [turns]);

  return (
    <div className="w-full h-[calc(100vh-53px)] overflow-y-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="text-left font-medium px-3 py-2 w-[44px]">#</th>
            <th className="text-left font-medium px-3 py-2 w-[100px]">Category</th>
            <th className="text-left font-medium px-3 py-2">Goal</th>
            <th className="text-left font-medium px-3 py-2 w-[200px]">Actions</th>
            <th className="text-left font-medium px-3 py-2 w-[200px]">Artifacts</th>
          </tr>
        </thead>
        <tbody>
          {significantTurns.map((turn) => {
            const isSelected = turn.id === selectedTurnId;
            const cat = categoryConfig[turn.category] ?? categoryConfig.conversation;
            const CatIcon = cat.icon;
            const hasErrors = turn.sections.corrections.items.length > 0;

            return (
              <tr
                key={turn.id}
                onClick={() => onSelectTurn(turn)}
                className={cn(
                  "cursor-pointer border-b border-border/50 transition-colors",
                  "hover:bg-secondary/30",
                  isSelected && "bg-primary/10",
                  turn.hasCommit && !isSelected && "border-l-2 border-l-emerald-500/40",
                  turn.hasCompaction && !isSelected && !turn.hasCommit && "border-l-2 border-l-yellow-500/40",
                  isSelected && "border-l-2 border-l-primary",
                  !turn.hasCommit && !turn.hasCompaction && !isSelected && "border-l-2 border-l-transparent"
                )}
              >
                {/* Index */}
                <td className="px-3 py-2 align-top">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {turn.index}
                  </span>
                </td>

                {/* Category */}
                <td className="px-3 py-2 align-top">
                  <span className={cn("inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded", cat.color, cat.bg)}>
                    <CatIcon className="w-3 h-3" />
                    {cat.label}
                  </span>
                </td>

                {/* Goal */}
                <td className="px-3 py-2 align-top">
                  <p className="text-sm leading-snug line-clamp-2">
                    {turn.sections.goal.summary}
                  </p>
                  {hasErrors && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-400 mt-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {turn.sections.corrections.summary}
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-3 py-2 align-top">
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {turn.sections.actions.summary !== "(no actions)"
                      ? turn.sections.actions.summary
                      : turn.sections.research.summary !== "(no research)"
                        ? turn.sections.research.summary
                        : ""
                    }
                  </span>
                </td>

                {/* Artifacts */}
                <td className="px-3 py-2 align-top">
                  {turn.commitMessage && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <GitCommit className="w-3 h-3 shrink-0" />
                      <span className="truncate">{turn.commitMessage}</span>
                    </span>
                  )}
                  {!turn.commitMessage && turn.hasCompaction && (
                    <span className="flex items-center gap-1 text-[11px] text-yellow-400">
                      <Layers className="w-3 h-3 shrink-0" />
                      compacted
                    </span>
                  )}
                  {!turn.commitMessage && !turn.hasCompaction && turn.sections.artifacts.summary !== "(no artifacts)" && (
                    <span className="text-xs text-muted-foreground">
                      {turn.sections.artifacts.summary}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
