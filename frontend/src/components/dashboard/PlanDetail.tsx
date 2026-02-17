"use client";

import { useState } from "react";
import type { SessionPlan, Workstream } from "@/lib/dashboard-types";
import { timeAgo } from "@/lib/utils";

interface PlanDetailProps {
  workstreams: Workstream[];
}

interface PlanEntry {
  workstreamName: string;
  plan: SessionPlan;
  title: string;
  tasksDone: number;
  tasksTotal: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  drafting: { label: "DRAFTING", color: "text-dash-purple", bg: "bg-dash-purple-dim" },
  implementing: { label: "IMPLEMENTING", color: "text-dash-yellow", bg: "bg-dash-yellow-dim" },
  completed: { label: "COMPLETED", color: "text-dash-green", bg: "bg-dash-green-dim" },
  rejected: { label: "REJECTED", color: "text-dash-red", bg: "bg-dash-red-dim" },
};

function extractTitle(md: string | null): string {
  if (!md) return "Untitled plan";
  const match = md.match(/^#\s+(.+)/m);
  return match ? match[1].slice(0, 60) : "Untitled plan";
}

function collectPlans(workstreams: Workstream[]): PlanEntry[] {
  const entries: PlanEntry[] = [];
  for (const ws of workstreams) {
    for (const plan of ws.plans) {
      if (plan.status === "none") continue;
      const done = plan.tasks.filter((t) => t.status === "completed").length;
      entries.push({
        workstreamName: ws.name,
        plan,
        title: extractTitle(plan.markdown),
        tasksDone: done,
        tasksTotal: plan.tasks.length,
      });
    }
  }
  return entries;
}

// ─── Overview ────────────────────────────────────────────────────────────────

const taskIcon: Record<string, { char: string; className: string }> = {
  completed: { char: "\u2713", className: "text-dash-green" },
  in_progress: { char: "\u25B6", className: "text-dash-blue" },
  pending: { char: "\u25CB", className: "text-dash-text-muted" },
  deleted: { char: "\u2212", className: "text-dash-text-muted opacity-40" },
};

function PlanOverview({
  entries,
  onSelect,
}: {
  entries: PlanEntry[];
  onSelect: (idx: number) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-dash-text-muted text-xs">
        No active plans
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center px-3.5 py-2.5 border-b border-dash-border bg-dash-surface">
        <span className="font-display font-bold text-xs text-dash-text">Plans</span>
        <span className="ml-2 text-[9px] text-dash-text-muted">{entries.length} total</span>
      </div>
      {entries.map((entry, i) => {
        const cfg = statusConfig[entry.plan.status];
        const isExpanded = expandedIdx === i;
        return (
          <div key={i} className="border-b border-dash-border">
            <button
              onClick={() => onSelect(i)}
              className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-dash-surface-2 transition-colors text-left"
            >
              <div className={`w-[3px] h-8 rounded-sm shrink-0 ${
                entry.plan.status === "completed" ? "bg-dash-green"
                  : entry.plan.status === "implementing" ? "bg-dash-yellow"
                  : entry.plan.status === "drafting" ? "bg-dash-purple"
                  : entry.plan.status === "rejected" ? "bg-dash-red"
                  : "bg-dash-text-muted"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-dash-text truncate">
                    {entry.title}
                  </span>
                  {cfg && (
                    <span className={`text-[7px] font-bold tracking-widest uppercase px-1 py-px rounded shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[9px] text-dash-text-muted">
                  <span className="font-semibold text-dash-text-dim">{entry.plan.agentLabel}</span>
                  <span>{entry.workstreamName}</span>
                  {entry.tasksTotal > 0 && (
                    <span
                      className="cursor-pointer transition-colors px-1 py-px rounded border border-dash-border hover:border-dash-text-muted hover:bg-dash-surface-2 text-dash-text-dim"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedIdx(isExpanded ? null : i);
                      }}
                    >
                      {entry.tasksDone}/{entry.tasksTotal} tasks {isExpanded ? "\u25B4" : "\u25BE"}
                    </span>
                  )}
                  <span>{timeAgo(entry.plan.timestamp)}</span>
                </div>
              </div>
              <span className="text-dash-text-muted text-[10px] shrink-0">&rsaquo;</span>
            </button>
            {isExpanded && entry.plan.tasks.length > 0 && (
              <div className="px-3.5 pb-2 pl-8 space-y-px">
                {entry.plan.tasks.map((task, ti) => {
                  const icon = taskIcon[task.status] ?? taskIcon.pending;
                  return (
                    <div
                      key={`${task.id}-${ti}`}
                      className="flex items-center gap-1.5 text-[10px] text-dash-text-dim"
                    >
                      <span className={`text-[9px] w-3 text-center shrink-0 ${icon.className}`}>
                        {icon.char}
                      </span>
                      <span className={`truncate ${task.status === "completed" ? "line-through opacity-50" : ""}`}>
                        {task.subject}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function PlanMarkdownView({
  entry,
  onBack,
}: {
  entry: PlanEntry;
  onBack: () => void;
}) {
  const cfg = statusConfig[entry.plan.status];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-dash-border bg-dash-surface">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="text-dash-text-muted hover:text-dash-text text-xs transition-colors"
          >
            &lsaquo; Plans
          </button>
          <span className="text-dash-border">|</span>
          <span className="font-display font-semibold text-[11px] text-dash-text truncate">
            {entry.title}
          </span>
          {cfg && (
            <span className={`text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-dash-text-dim font-semibold">{entry.plan.agentLabel}</span>
          <span className="text-[9px] text-dash-text-muted">{timeAgo(entry.plan.timestamp)}</span>
          {entry.tasksTotal > 0 && (
            <span className="text-[9px] text-dash-text-muted">
              {entry.tasksDone}/{entry.tasksTotal} tasks
            </span>
          )}
        </div>
      </div>

      {/* Markdown body */}
      <div className="px-3.5 py-2.5 text-[11px] text-dash-text-dim">
        {entry.plan.markdown ? renderMarkdown(entry.plan.markdown) : (
          <div className="text-dash-text-muted text-xs">No plan content</div>
        )}
      </div>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function PlanDetail({ workstreams }: PlanDetailProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const entries = collectPlans(workstreams);

  if (selectedIdx !== null && selectedIdx < entries.length) {
    return (
      <PlanMarkdownView
        entry={entries[selectedIdx]}
        onBack={() => setSelectedIdx(null)}
      />
    );
  }

  return <PlanOverview entries={entries} onSelect={setSelectedIdx} />;
}

// ─── Markdown rendering ─────────────────────────────────────────────────────

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizes = ["text-sm font-bold", "text-xs font-bold", "text-[11px] font-semibold", "text-[11px] font-semibold text-dash-text-dim"];
      nodes.push(
        <div key={i} className={`${sizes[level - 1]} mt-2 mb-1`}>
          {renderInline(text)}
        </div>
      );
      i++;
      continue;
    }

    // Table detection
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1]?.match(/^\|[\s\-:|]+\|$/)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      nodes.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    // Unordered list items
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (ulMatch) {
      const indent = Math.floor(ulMatch[1].length / 2);
      nodes.push(
        <div key={i} className="flex gap-1.5" style={{ paddingLeft: `${indent * 12}px` }}>
          <span className="text-dash-text-muted shrink-0">&#x2022;</span>
          <span>{renderInline(ulMatch[2])}</span>
        </div>
      );
      i++;
      continue;
    }

    // Ordered list items
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      const indent = Math.floor(olMatch[1].length / 2);
      const numMatch = line.match(/^(\s*)(\d+)\./);
      nodes.push(
        <div key={i} className="flex gap-1.5" style={{ paddingLeft: `${indent * 12}px` }}>
          <span className="text-dash-text-muted shrink-0">{numMatch?.[2]}.</span>
          <span>{renderInline(olMatch[2])}</span>
        </div>
      );
      i++;
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push(
        <pre key={`code-${i}`} className="bg-dash-surface-2 rounded p-2 text-[10px] text-dash-text-dim overflow-x-auto my-1">
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      nodes.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }

    // Regular paragraph
    nodes.push(
      <div key={i} className="leading-relaxed">
        {renderInline(line)}
      </div>
    );
    i++;
  }

  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-semibold text-dash-text">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <code key={match.index} className="bg-dash-surface-2 text-dash-blue px-1 py-0.5 rounded text-[10px]">
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      parts.push(<em key={match.index}>{match[4]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const parseRow = (line: string) =>
    line.split("|").slice(1, -1).map((c) => c.trim());

  if (lines.length < 2) return null;
  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);

  return (
    <div className="overflow-x-auto my-1">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-2 py-1 border-b border-dash-border font-semibold text-dash-text-dim">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-2 py-1 border-b border-dash-border text-dash-text-dim">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
