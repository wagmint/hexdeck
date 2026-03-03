import { GlowHex } from "../GlowHex";
import type { TraySeverity } from "../../lib/alerts";

interface ColorLegendContentProps {
  compact?: boolean;
}

const colors: { severity: TraySeverity; label: string; description: string }[] = [
  {
    severity: "blue",
    label: "Waiting",
    description: "Agent needs your approval",
  },
  {
    severity: "green",
    label: "Active",
    description: "Agent is working",
  },
  {
    severity: "grey",
    label: "Idle",
    description: "No active agents",
  },
];

export function ColorLegendContent({ compact }: ColorLegendContentProps) {
  const gap = compact ? "gap-2" : "gap-3";
  const hexSize = compact ? 2.5 : 3;
  const textSize = compact ? "text-[11px]" : "text-xs";

  return (
    <div className={`flex flex-col ${gap}`}>
      {colors.map((c) => (
        <div key={c.label} className="flex items-center gap-2.5">
          <GlowHex severity={c.severity} size={hexSize} />
          <span className={`${textSize} font-medium text-dash-text`}>
            {c.label}
          </span>
          <span className={`${textSize} text-dash-text-dim`}>
            {c.description}
          </span>
        </div>
      ))}
    </div>
  );
}
