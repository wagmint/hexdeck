import type { TraySeverity } from "../lib/alerts";

const dotColorClass: Record<TraySeverity, string> = {
  red: "bg-dash-red",
  yellow: "bg-dash-yellow",
  blue: "bg-dash-blue",
  green: "bg-dash-green",
  grey: "bg-dash-text-muted",
};

const pulseClass: Record<TraySeverity, string> = {
  red: "animate-dash-pulse",
  yellow: "",
  blue: "animate-dash-pulse",
  green: "",
  grey: "",
};

interface StatusHeaderProps {
  severity: TraySeverity;
  agentCount: number;
  connected: boolean;
}

export function StatusHeader({
  severity,
  agentCount,
  connected,
}: StatusHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-dash-border">
      <div className="flex items-center gap-2.5">
        <div
          className={`w-2.5 h-2.5 rounded-full ${dotColorClass[severity]} ${pulseClass[severity]}`}
        />
        <span className="text-sm font-semibold text-dash-text">Hexdeck</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-dash-text-dim">
          {agentCount} agent{agentCount !== 1 ? "s" : ""}
        </span>
        {!connected && (
          <span className="text-[10px] text-dash-red font-medium">
            disconnected
          </span>
        )}
      </div>
    </div>
  );
}
