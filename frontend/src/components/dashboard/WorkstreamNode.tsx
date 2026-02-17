"use client";

import type { Workstream, PlanTask, AgentStatus } from "@/lib/dashboard-types";

interface WorkstreamNodeProps {
  workstream: Workstream;
}

const planStatusBadge: Record<string, { label: string; className: string }> = {
  drafting: { label: "PLANNING", className: "text-dash-purple bg-dash-purple/10" },
  implementing: { label: "BUILDING", className: "text-dash-yellow bg-dash-yellow/10" },
  completed: { label: "DONE", className: "text-dash-text-muted bg-dash-surface-2" },
  rejected: { label: "REJECTED", className: "text-dash-red bg-dash-red/10" },
};

const agentDot: Record<AgentStatus, string> = {
  busy: "bg-dash-green animate-pulse",
  idle: "bg-dash-text-muted",
  warning: "bg-dash-yellow",
  conflict: "bg-dash-red",
};

const taskStatusIcon: Record<PlanTask["status"], { char: string; className: string }> = {
  completed: { char: "\u2713", className: "text-dash-green" },
  in_progress: { char: "\u2192", className: "text-dash-blue animate-pulse" },
  pending: { char: "\u2013", className: "text-dash-text-muted" },
  deleted: { char: "\u2013", className: "text-dash-text-muted" },
};

export function WorkstreamNode({ workstream }: WorkstreamNodeProps) {
  const statusColor = workstream.hasCollision
    ? "bg-dash-red"
    : workstream.errors > 0
      ? "bg-dash-yellow"
      : "bg-dash-green";

  const activePlan = workstream.plans.find(p => p.status !== "none");
  const badge = activePlan ? planStatusBadge[activePlan.status] : null;

  return (
    <div className="flex gap-2.5 px-3.5 py-2 border-b border-dash-border items-start">
      <div className={`w-[3px] min-h-[32px] rounded-sm ${statusColor} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-display font-semibold text-[11px]">
            {workstream.name}
          </span>
          {badge && (
            <span className={`text-[8px] font-semibold px-1 py-px rounded ${badge.className}`}>
              {badge.label}
            </span>
          )}
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

        {/* Agent names */}
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
          {workstream.agents.map((agent) => (
            <div key={agent.sessionId} className="flex items-center gap-1 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${agentDot[agent.status]}`} />
              <span className="text-dash-text-dim">{agent.label}</span>
              <span className={`text-[7px] font-semibold px-0.5 rounded font-mono ${
                agent.agentType === "codex"
                  ? "text-dash-green/70"
                  : "text-dash-blue/70"
              }`}>
                {agent.agentType === "codex" ? "codex" : "claude"}
              </span>
            </div>
          ))}
        </div>

        {/* Plan tasks checklist */}
        {workstream.planTasks.length > 0 ? (
          <div className="mt-1.5 pl-1 space-y-0.5">
            {workstream.planTasks.slice(0, 8).map((task, idx) => {
              const icon = taskStatusIcon[task.status];
              return (
                <div
                  key={`${task.id}-${idx}`}
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
            {workstream.planTasks.length > 8 && (
              <div className="text-[9px] text-dash-text-muted pl-4">
                +{workstream.planTasks.length - 8} more
              </div>
            )}
          </div>
        ) : (
          /* Fall back to active agent tasks */
          workstream.agents.some((a) => a.isActive) && (
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
                    <span className="shrink-0 ml-2 flex items-center gap-1">
                      <span className="text-dash-blue">{agent.label}</span>
                      <span className={`text-[7px] font-semibold font-mono ${
                        agent.agentType === "codex"
                          ? "text-dash-green/70"
                          : "text-dash-blue/70"
                      }`}>
                        {agent.agentType === "codex" ? "codex" : "claude"}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
