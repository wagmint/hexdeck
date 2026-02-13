"use client";

import type { Workstream, PlanStatus } from "@/lib/dashboard-types";
import { AgentPip } from "./AgentPip";
import { useRouter } from "next/navigation";

interface AgentCardProps {
  workstream: Workstream;
}

const planBadges: Partial<Record<PlanStatus, { label: string; className: string }>> = {
  drafting: { label: "PLANNING", className: "text-dash-purple bg-dash-purple/10" },
  approved: { label: "PLANNED", className: "text-dash-blue bg-dash-blue/10" },
  implementing: { label: "BUILDING", className: "text-dash-green bg-dash-green/10" },
};

export function AgentCard({ workstream }: AgentCardProps) {
  const router = useRouter();
  const hasActive = workstream.agents.some((a) => a.isActive);
  const focusAgent = workstream.agents.find((a) => a.isActive);

  // Find the most advanced plan status across agents
  const activePlan = workstream.plans.find(p => p.status !== "none");
  const badge = activePlan ? planBadges[activePlan.status] : null;

  // Task progress
  const hasTasks = workstream.planTasks.length > 0;
  const tasksDone = hasTasks
    ? workstream.planTasks.filter(t => t.status === "completed").length
    : 0;

  return (
    <div
      className={`px-3.5 py-2.5 border-b border-dash-border cursor-pointer transition-colors hover:bg-dash-surface ${
        hasActive ? "bg-dash-surface-2 border-l-2 border-l-dash-green" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-semibold text-xs text-dash-text">
            {workstream.name}
          </span>
          {badge && (
            <span className={`text-[8px] font-semibold px-1 py-px rounded ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
        <span className="text-[9px] text-dash-text-muted uppercase tracking-wide">
          {workstream.agents.length} agent{workstream.agents.length !== 1 ? "s" : ""}
        </span>
      </div>
      {focusAgent && (
        <div className="text-[10px] text-dash-text-dim mt-1 truncate">
          Focus:{" "}
          <span className="text-dash-blue font-medium">
            {focusAgent.currentTask}
          </span>
        </div>
      )}
      {hasTasks && (
        <div className="text-[9px] text-dash-text-muted mt-0.5">
          {tasksDone}/{workstream.planTasks.length} tasks done
        </div>
      )}
      <div className="flex items-center gap-0.5 mt-1.5">
        {workstream.agents.map((agent) => (
          <AgentPip
            key={agent.sessionId}
            status={agent.status}
            onClick={() => router.push(`/session/${agent.sessionId}`)}
          />
        ))}
        <span className="text-[9px] text-dash-text-muted ml-1">
          {workstream.agents.length}
        </span>
      </div>
    </div>
  );
}
