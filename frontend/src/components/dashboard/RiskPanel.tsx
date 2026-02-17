"use client";

import type { Agent, RiskLevel } from "@/lib/dashboard-types";
import { OperatorTag } from "./OperatorTag";

interface RiskPanelProps {
  agents: Agent[];
}

export function RiskPanel({ agents }: RiskPanelProps) {
  // Sort: critical first, then elevated, then nominal
  const sorted = [...agents].sort((a, b) => {
    const order: Record<RiskLevel, number> = { critical: 0, elevated: 1, nominal: 2 };
    return order[a.risk.overallRisk] - order[b.risk.overallRisk];
  });

  return (
    <div>
      {sorted.map((agent) => (
        <RiskCard key={agent.sessionId} agent={agent} />
      ))}
    </div>
  );
}

function RiskCard({ agent }: { agent: Agent }) {
  const { risk, label, sessionId } = agent;
  const slug = sessionId.slice(0, 8);

  return (
    <div className="px-3.5 py-2.5 border-b border-dash-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-dash-text font-semibold text-[11px]">{label}</span>
          <span className={`text-[8px] font-semibold px-1 py-px rounded border font-mono ${
            agent.agentType === "codex"
              ? "text-dash-green border-dash-green/30 bg-dash-green/10"
              : "text-dash-blue border-dash-blue/30 bg-dash-blue/10"
          }`}>
            {agent.agentType === "codex" ? "codex" : "claude"}
          </span>
          <span className="text-dash-text-muted text-[9px]">{slug}</span>
          <OperatorTag operatorId={agent.operatorId} />
        </div>
        <RiskBadge level={risk.overallRisk} />
      </div>

      {/* Error Rate */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] text-dash-text-muted w-16 shrink-0">Err rate</span>
        <MiniBar value={risk.errorRate} thresholds={[0.15, 0.35]} />
        <span className="text-[9px] text-dash-text-dim w-8 text-right">{pct(risk.errorRate)}</span>
      </div>

      {/* Correction Ratio */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] text-dash-text-muted w-16 shrink-0">Fixes</span>
        <MiniBar value={risk.correctionRatio} thresholds={[0.4, 0.7]} invert />
        <span className="text-[9px] text-dash-text-dim w-8 text-right">{pct(risk.correctionRatio)}</span>
      </div>

      {/* Tokens + Compactions */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[9px] text-dash-text-muted">
          {formatTokens(risk.totalTokens)} tokens
        </span>
        {risk.compactions > 0 && (
          <span className="text-[9px] text-dash-text-muted">
            {risk.compactions} compaction{risk.compactions !== 1 ? "s" : ""}
          </span>
        )}
        {risk.compactionProximity !== "nominal" && (
          <span className={`text-[8px] font-bold tracking-widest uppercase px-1 py-px rounded ${
            risk.compactionProximity === "critical"
              ? "bg-dash-red-dim text-dash-red"
              : "bg-dash-yellow-dim text-dash-yellow"
          }`}>
            CTX {risk.compactionProximity.toUpperCase()}
          </span>
        )}
      </div>

      {/* Error Trend Sparkline */}
      {risk.errorTrend.length > 0 && (
        <div className="mb-1">
          <ErrorTrendLine trend={risk.errorTrend} />
        </div>
      )}

      {/* Spinning Signals */}
      {risk.spinningSignals.length > 0 && (
        <div className="space-y-0.5 mb-1">
          {risk.spinningSignals.map((sig, i) => (
            <div key={i} className={`text-[9px] flex items-center gap-1 ${
              sig.level === "critical" ? "text-dash-red" : "text-dash-yellow"
            }`}>
              <span>{sig.level === "critical" ? "\u25B2" : "\u25B3"}</span>
              <span>{sig.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* File Hotspots */}
      {risk.fileHotspots.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {risk.fileHotspots.map((h, i) => (
            <span key={i} className="text-[8px] text-dash-text-muted bg-dash-surface px-1 py-px rounded">
              {h.file.split("/").pop()}({h.count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const config: Record<RiskLevel, { label: string; className: string }> = {
    nominal: { label: "NOMINAL", className: "bg-dash-green-dim text-dash-green" },
    elevated: { label: "ELEVATED", className: "bg-dash-yellow-dim text-dash-yellow" },
    critical: { label: "CRITICAL", className: "bg-dash-red-dim text-dash-red" },
  };
  const { label, className } = config[level];
  return (
    <span className={`text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${className}`}>
      {label}
    </span>
  );
}

function MiniBar({ value, thresholds, invert }: { value: number; thresholds: [number, number]; invert?: boolean }) {
  const clamped = Math.max(0, Math.min(1, value));
  const pctWidth = Math.round(clamped * 100);

  let color: string;
  if (invert) {
    // Higher is better (green > threshold[1], yellow > threshold[0], red below)
    if (value >= thresholds[1]) color = "bg-dash-green";
    else if (value >= thresholds[0]) color = "bg-dash-yellow";
    else color = "bg-dash-red";
  } else {
    // Lower is better
    if (value <= thresholds[0]) color = "bg-dash-green";
    else if (value <= thresholds[1]) color = "bg-dash-yellow";
    else color = "bg-dash-red";
  }

  return (
    <div className="flex-1 h-1.5 bg-dash-surface-3 rounded-sm overflow-hidden">
      <div className={`h-full rounded-sm ${color}`} style={{ width: `${pctWidth}%` }} />
    </div>
  );
}

function ErrorTrendLine({ trend }: { trend: boolean[] }) {
  return (
    <div className="flex items-end gap-px h-3">
      {trend.map((hasError, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${hasError ? "bg-dash-red h-full" : "bg-dash-surface-3 h-1"}`}
        />
      ))}
    </div>
  );
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
