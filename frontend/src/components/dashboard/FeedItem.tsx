"use client";

import type { FeedEvent } from "@/lib/dashboard-types";
import { timeAgo } from "@/lib/utils";

interface FeedItemProps {
  event: FeedEvent;
  isNew?: boolean;
  onClick?: () => void;
}

const typeConfig: Record<
  FeedEvent["type"],
  { icon: string; iconClass: string; rowClass?: string }
> = {
  collision: {
    icon: "\u26A1",
    iconClass: "bg-dash-red-dim text-dash-red",
    rowClass: "bg-dash-red-dim border-l-2 border-l-dash-red",
  },
  error: {
    icon: "\u2716",
    iconClass: "bg-dash-yellow-dim text-dash-yellow",
    rowClass: "bg-dash-yellow-dim border-l-2 border-l-dash-yellow",
  },
  completion: {
    icon: "\u2713",
    iconClass: "bg-dash-green-dim text-dash-green",
  },
  compaction: {
    icon: "\u21BB",
    iconClass: "bg-dash-blue-dim text-dash-blue",
  },
  start: {
    icon: "\u2192",
    iconClass: "bg-dash-blue-dim text-dash-blue",
  },
  plan_started: {
    icon: "\u270E",
    iconClass: "bg-dash-purple-dim text-dash-purple",
  },
  plan_approved: {
    icon: "\u2713",
    iconClass: "bg-dash-blue-dim text-dash-blue",
  },
  task_completed: {
    icon: "\u2713",
    iconClass: "bg-dash-green-dim text-dash-green",
  },
};

export function FeedItem({ event, isNew, onClick }: FeedItemProps) {
  const config = typeConfig[event.type];
  return (
    <div
      onClick={onClick}
      className={`flex gap-2 px-3.5 py-2 border-b border-dash-border text-[10px] transition-colors hover:bg-dash-surface ${config.rowClass ?? ""} ${isNew ? "animate-flash-in" : ""} ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="text-[9px] text-dash-text-muted whitespace-nowrap min-w-[40px]">
        {timeAgo(event.timestamp)}
      </div>
      <div
        className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] shrink-0 ${config.iconClass}`}
      >
        {config.icon}
      </div>
      <div className="flex-1 leading-relaxed text-dash-text-dim">
        <span className="text-dash-text font-semibold">{event.agentLabel}</span>
        {" "}
        {event.message}
      </div>
    </div>
  );
}
