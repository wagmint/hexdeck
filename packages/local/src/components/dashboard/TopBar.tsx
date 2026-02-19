"use client";

import type { DashboardSummary, Operator } from "@/lib/dashboard-types";

interface TopBarProps {
  summary: DashboardSummary;
  operators: Operator[];
}

export function TopBar({ summary, operators }: TopBarProps) {
  return (
    <div className="flex items-center justify-between px-4 h-10 bg-dash-surface border-b border-dash-border">
      <div className="font-display font-bold text-sm tracking-tight text-dash-green">
        PYLON{" "}
        <span className="font-normal text-dash-text-dim">control surface</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="inline-flex items-center gap-1 bg-dash-green-dim text-dash-green text-[8px] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">
          <span className="w-1 h-1 rounded-full bg-dash-green animate-dash-pulse" />
          LIVE
        </div>
        {operators.length > 1 && (
          <div className="flex items-center gap-2 px-2 border-l border-r border-dash-border">
            {operators.map((op) => (
              <div key={op.id} className="flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${op.status === "online" ? "animate-dash-pulse" : "opacity-40"}`}
                  style={{ backgroundColor: op.color }}
                />
                <span className="text-[9px] text-dash-text-dim font-mono">{op.name}</span>
              </div>
            ))}
          </div>
        )}
        <StatusItem
          color="green"
          text={`${summary.activeAgents} agent${summary.activeAgents !== 1 ? "s" : ""} active`}
        />
        {summary.totalCollisions > 0 && (
          <StatusItem
            color="yellow"
            text={`${summary.totalCollisions} collision${summary.totalCollisions !== 1 ? "s" : ""}`}
          />
        )}
        {summary.criticalCollisions > 0 && (
          <StatusItem
            color="red"
            text={`${summary.criticalCollisions} critical`}
          />
        )}
        {summary.agentsAtRisk > 0 && (
          <StatusItem
            color="yellow"
            text={`${summary.agentsAtRisk} agent${summary.agentsAtRisk !== 1 ? "s" : ""} at risk`}
          />
        )}
        <span className="text-dash-text-muted text-[11px] font-mono">
          {summary.totalWorkstreams} project{summary.totalWorkstreams !== 1 ? "s" : ""}
          {" / "}
          {summary.totalCommits} commit{summary.totalCommits !== 1 ? "s" : ""}
        </span>
        {summary.totalCost > 0 && (
          <span className="text-dash-text-muted text-[11px] font-mono" title="Estimated cost (May 2025 rates)">
            ${summary.totalCost.toFixed(2)} spend
          </span>
        )}
      </div>
    </div>
  );
}

function StatusItem({ color, text }: { color: "green" | "yellow" | "red"; text: string }) {
  const dotColor = {
    green: "bg-dash-green",
    yellow: "bg-dash-yellow",
    red: "bg-dash-red",
  }[color];

  const pulseClass = color === "red" ? "animate-conflict-flash" : "animate-dash-pulse";

  return (
    <div className="flex items-center gap-1.5 text-dash-text-dim text-[11px] font-mono">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${pulseClass}`} />
      {text}
    </div>
  );
}
