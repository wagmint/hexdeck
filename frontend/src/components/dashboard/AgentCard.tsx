"use client";

import type { Workstream } from "@/lib/dashboard-types";
import { AgentPip } from "./AgentPip";
import { useRouter } from "next/navigation";

interface AgentCardProps {
  workstream: Workstream;
}

export function AgentCard({ workstream }: AgentCardProps) {
  const router = useRouter();
  const hasActive = workstream.agents.some((a) => a.isActive);
  const focusAgent = workstream.agents.find((a) => a.isActive);

  return (
    <div
      className={`px-3.5 py-2.5 border-b border-dash-border cursor-pointer transition-colors hover:bg-dash-surface ${
        hasActive ? "bg-dash-surface-2 border-l-2 border-l-dash-green" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-display font-semibold text-xs text-dash-text">
          {workstream.name}
        </span>
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
