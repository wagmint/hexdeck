import type { Agent, AgentStatus } from "../lib/types";

const statusDot: Record<AgentStatus, string> = {
  idle: "bg-dash-text-muted",
  busy: "bg-dash-green",
  warning: "bg-dash-yellow",
  conflict: "bg-dash-red",
};

const statusLabel: Record<AgentStatus, string> = {
  idle: "Idle",
  busy: "Working",
  warning: "Warning",
  conflict: "Conflict",
};

function projectName(projectPath: string): string {
  const parts = projectPath.split("/");
  return parts[parts.length - 1] || projectPath;
}

interface AgentListProps {
  agents: Agent[];
}

export function AgentList({ agents }: AgentListProps) {
  const activeAgents = agents.filter((a) => a.isActive);
  const inactiveAgents = agents.filter((a) => !a.isActive);

  if (agents.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-dash-text-muted">No agents connected</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      {activeAgents.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-dash-text-muted px-1">
            Active ({activeAgents.length})
          </span>
          {activeAgents.map((agent) => (
            <AgentRow key={agent.sessionId} agent={agent} />
          ))}
        </div>
      )}

      {inactiveAgents.length > 0 && (
        <div className={`space-y-1 ${activeAgents.length > 0 ? "mt-2" : ""}`}>
          <span className="text-[10px] font-medium uppercase tracking-wider text-dash-text-muted px-1">
            Inactive ({inactiveAgents.length})
          </span>
          {inactiveAgents.slice(0, 3).map((agent) => (
            <AgentRow key={agent.sessionId} agent={agent} dimmed />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentRow({
  agent,
  dimmed = false,
}: {
  agent: Agent;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-dash-surface-2 transition-colors ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${statusDot[agent.status]} ${
          agent.status === "busy" ? "animate-dash-pulse" : ""
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-dash-text truncate">
            {agent.label}
          </span>
          <span className="text-[10px] text-dash-text-muted flex-shrink-0 ml-2">
            {statusLabel[agent.status]}
          </span>
        </div>
        {agent.currentTask && (
          <p className="text-[11px] text-dash-text-dim truncate mt-0.5">
            {agent.currentTask}
          </p>
        )}
        <p className="text-[10px] text-dash-text-muted truncate">
          {projectName(agent.projectPath)}
        </p>
      </div>
    </div>
  );
}
