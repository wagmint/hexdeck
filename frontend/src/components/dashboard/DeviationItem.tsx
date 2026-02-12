"use client";

import type { Collision } from "@/lib/dashboard-types";
import { timeAgo } from "@/lib/utils";

interface DeviationItemProps {
  collision: Collision;
}

export function DeviationItem({ collision }: DeviationItemProps) {
  const fileName = collision.filePath.split("/").pop() ?? collision.filePath;
  const agentLabels = collision.agents.map((a) => a.label).join(" & ");

  const typeConfig = collision.severity === "critical"
    ? { label: "COLLISION", className: "bg-dash-red-dim text-dash-red" }
    : { label: "OVERLAP", className: "bg-dash-yellow-dim text-dash-yellow" };

  return (
    <div className="px-3.5 py-2 border-b border-dash-border text-[10px]">
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={`text-[8px] font-bold tracking-widest uppercase px-1 py-px rounded ${typeConfig.className}`}
        >
          {typeConfig.label}
        </span>
        <span className="text-[9px] text-dash-text-muted">
          {timeAgo(collision.detectedAt)}
        </span>
      </div>
      <div className="text-dash-text-dim leading-relaxed">
        <span className="text-dash-text font-semibold">{agentLabels}</span> both
        modifying <span className="text-dash-text font-semibold">{fileName}</span>
        {collision.agents[0] && (
          <span className="text-dash-text-muted">
            {" "}— {collision.agents[0].lastAction}
          </span>
        )}
      </div>
    </div>
  );
}
