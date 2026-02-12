"use client";

import type { Workstream } from "@/lib/dashboard-types";

interface WorkstreamNodeProps {
  workstream: Workstream;
}

export function WorkstreamNode({ workstream }: WorkstreamNodeProps) {
  const statusColor = workstream.hasCollision
    ? "bg-dash-red"
    : workstream.errors > 0
      ? "bg-dash-yellow"
      : "bg-dash-green";

  return (
    <div className="flex gap-2.5 px-3.5 py-2 border-b border-dash-border items-start">
      <div className={`w-[3px] min-h-[32px] rounded-sm ${statusColor} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-[11px] mb-0.5">
          {workstream.name}
        </div>
        <div className="flex gap-2.5 text-[9px] text-dash-text-muted">
          <span className="text-dash-blue">
            {workstream.agents.filter((a) => a.isActive).length} active
          </span>
          <span>
            {workstream.totalTurns} turn{workstream.totalTurns !== 1 ? "s" : ""}
          </span>
          {workstream.commits > 0 && (
            <span className="text-dash-green">{workstream.commits} commits</span>
          )}
          {workstream.hasCollision && (
            <span className="text-dash-red font-semibold">COLLISION</span>
          )}
        </div>
        {workstream.agents.some((a) => a.isActive) && (
          <div className="mt-1 pl-2 border-l border-dash-border">
            {workstream.agents
              .filter((a) => a.isActive)
              .slice(0, 4)
              .map((agent) => (
                <div
                  key={agent.sessionId}
                  className="flex items-center justify-between py-0.5 text-[10px] text-dash-text-dim"
                >
                  <span className="truncate">{agent.currentTask}</span>
                  <span className="text-dash-blue shrink-0 ml-2">
                    {agent.label}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
