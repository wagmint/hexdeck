"use client";

import type { Workstream } from "@/lib/dashboard-types";

interface ProgressBarProps {
  workstream: Workstream;
}

export function ProgressBar({ workstream }: ProgressBarProps) {
  const pct = workstream.completionPct;
  const colorClass = workstream.hasCollision
    ? "bg-dash-red"
    : workstream.errors > 0
      ? "bg-dash-yellow"
      : "bg-dash-green";
  const pctColorClass = workstream.hasCollision
    ? "text-dash-red"
    : workstream.errors > 0
      ? "text-dash-yellow"
      : "text-dash-green";

  return (
    <div className="px-3.5 py-2 border-b border-dash-border">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-medium">
          {workstream.name}
        </span>
        <span className={`text-[10px] font-semibold ${pctColorClass}`}>
          {pct}%
        </span>
      </div>
      <div className="h-[3px] bg-dash-surface-3 rounded-full mt-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[9px] text-dash-text-muted mt-1">
        {workstream.agents.filter((a) => a.isActive).length} active agent
        {workstream.agents.filter((a) => a.isActive).length !== 1 ? "s" : ""}
        {workstream.hasCollision && (
          <span className="text-dash-red"> · collision</span>
        )}
      </div>
    </div>
  );
}
