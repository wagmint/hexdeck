import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import type { DashboardState } from "../lib/types";
import type { PylonAlert, TraySeverity } from "../lib/alerts";
import { StatusHeader } from "./StatusHeader";
import { AlertList } from "./AlertList";
import { AgentList } from "./AgentList";

interface MenuBarAppProps {
  state: DashboardState | null;
  alerts: PylonAlert[];
  severity: TraySeverity;
  connected: boolean;
  loading: boolean;
  error: string | null;
}

export function MenuBarApp({
  state,
  alerts,
  severity,
  connected,
  loading,
  error,
}: MenuBarAppProps) {
  const agentCount = state?.summary.activeAgents ?? 0;
  const agents = state?.agents ?? [];

  return (
    <div className="flex flex-col h-screen bg-dash-bg border border-dash-border rounded-xl overflow-hidden shadow-lg">
      <StatusHeader
        severity={severity}
        agentCount={agentCount}
        connected={connected}
      />

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-dash-text-muted">Connecting...</p>
          </div>
        )}

        {!loading && error && !state && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-dash-red">{error}</p>
            <p className="text-[10px] text-dash-text-muted mt-1">
              Is the Hexdeck server running?
            </p>
          </div>
        )}

        {!loading && state && (
          <>
            <AlertList alerts={alerts} />
            {alerts.length > 0 && agents.length > 0 && (
              <div className="border-t border-dash-border" />
            )}
            <AgentList agents={agents} />
          </>
        )}
      </div>

      <div className="border-t border-dash-border px-3 py-2">
        <button
          onClick={() => open("http://localhost:3002")}
          className="w-full text-xs text-dash-blue hover:text-dash-text transition-colors py-1.5 rounded-md hover:bg-dash-surface-2"
        >
          Open Dashboard
        </button>
        <button
          onClick={() => invoke("quit_app")}
          className="w-full mt-1 text-xs text-dash-text-muted hover:text-dash-red transition-colors py-1.5 rounded-md hover:bg-dash-surface-2"
        >
          Quit Hexdeck
        </button>
      </div>
    </div>
  );
}
