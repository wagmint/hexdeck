"use client";

import { useState } from "react";
import type { RelayTargetInfo, ActiveProject } from "../types";

export interface RelayPanelProps {
  targets: RelayTargetInfo[];
  activeProjects: ActiveProject[];
  onConnect: (link: string) => Promise<{ error?: string }>;
  onRemove: (pylonId: string) => void;
  onToggleProject: (pylonId: string, projectPath: string, include: boolean) => void;
  onClose: () => void;
}

export function RelayPanel({
  targets,
  activeProjects,
  onConnect,
  onRemove,
  onToggleProject,
  onClose,
}: RelayPanelProps) {
  const [link, setLink] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!link.trim()) return;
    setConnecting(true);
    setConnectError(null);
    const result = await onConnect(link.trim());
    setConnecting(false);
    if (result.error) {
      setConnectError(result.error);
    } else {
      setLink("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConnect();
  };

  return (
    <div className="flex flex-col h-full bg-dash-surface border-l border-dash-border font-mono text-[11px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-dash-border shrink-0">
        <span className="text-[9px] font-semibold tracking-[1.5px] uppercase text-dash-text-muted">
          Relay
        </span>
        <button
          onClick={onClose}
          className="text-dash-text-muted hover:text-dash-text transition-colors px-1"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4">
        {/* Connect section */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="pylon+wss://..."
              className="flex-1 bg-dash-bg border border-dash-border rounded px-2 py-1 text-[11px] font-mono text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:border-dash-blue"
            />
            <button
              onClick={handleConnect}
              disabled={connecting || !link.trim()}
              className="px-3 py-1 bg-dash-surface-3 border border-dash-border rounded text-[10px] text-dash-text-dim hover:text-dash-text hover:bg-dash-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connecting ? "..." : "Connect"}
            </button>
          </div>
          {connectError && (
            <div className="text-dash-red text-[10px]">{connectError}</div>
          )}
        </div>

        {/* Target cards */}
        {targets.length === 0 ? (
          <div className="text-center text-dash-text-muted text-xs py-6">
            No relay targets. Paste a connect link to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {targets.map((target) => (
              <TargetCard
                key={target.pylonId}
                target={target}
                activeProjects={activeProjects}
                onRemove={onRemove}
                onToggleProject={onToggleProject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TargetCard({
  target,
  activeProjects,
  onRemove,
  onToggleProject,
}: {
  target: RelayTargetInfo;
  activeProjects: ActiveProject[];
  onRemove: (pylonId: string) => void;
  onToggleProject: (pylonId: string, projectPath: string, include: boolean) => void;
}) {
  const statusDot = {
    connected: "bg-dash-green",
    connecting: "bg-dash-yellow animate-dash-pulse",
    disconnected: "bg-dash-text-muted",
  }[target.status];

  const home = typeof window !== "undefined" ? "" : "";

  return (
    <div className="border border-dash-border rounded bg-dash-bg p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
          <span className="text-dash-text truncate font-semibold">{target.pylonName}</span>
          <span className="text-dash-text-muted text-[9px] shrink-0">
            {target.pylonId.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-dash-text-muted">{target.status}</span>
          <button
            onClick={() => onRemove(target.pylonId)}
            className="text-[9px] text-dash-red/60 hover:text-dash-red transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Project toggles */}
      {activeProjects.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-dash-border">
          {activeProjects.map((proj) => {
            const included = target.projects.includes(proj.projectPath);
            return (
              <div
                key={proj.projectPath}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-dash-text-dim truncate" title={proj.projectPath}>
                    {abbreviatePath(proj.projectPath)}
                  </span>
                  <span className="text-[9px] text-dash-text-muted shrink-0">
                    {proj.sessionCount} session{proj.sessionCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => onToggleProject(target.pylonId, proj.projectPath, !included)}
                  className={`w-7 h-4 rounded-full relative transition-colors shrink-0 ${
                    included ? "bg-dash-green/40" : "bg-dash-surface-3"
                  }`}
                >
                  <span
                    className={`block w-3 h-3 rounded-full absolute top-0.5 transition-all ${
                      included
                        ? "left-3.5 bg-dash-green"
                        : "left-0.5 bg-dash-text-muted"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function abbreviatePath(p: string): string {
  // Replace home directory prefix with ~
  const home =
    typeof process !== "undefined"
      ? process.env?.HOME || process.env?.USERPROFILE || ""
      : "";
  if (home && p.startsWith(home)) {
    return "~" + p.slice(home.length);
  }
  return p;
}
