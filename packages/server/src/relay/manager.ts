import type { DashboardState } from "../types/index.js";
import { loadOperatorConfig, getSelfName, getOperatorColor } from "../core/config.js";
import { loadRelayConfig } from "./config.js";
import { transformToOperatorState } from "./transform.js";
import { RelayConnection } from "./connection.js";

class RelayManager {
  private connections = new Map<string, RelayConnection>();
  private started = false;

  /** True if any relay targets are configured (keeps ticker alive). */
  get hasTargets(): boolean {
    const config = loadRelayConfig();
    return config.targets.length > 0;
  }

  /** Load config and open connections to all targets. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.syncConnections();
  }

  /** Close all connections. */
  stop(): void {
    this.started = false;
    for (const conn of this.connections.values()) {
      conn.disconnect();
    }
    this.connections.clear();
  }

  /**
   * Called by the ticker on each interval.
   * Re-reads config (mtime-cached), syncs connections, transforms & sends state.
   */
  onStateUpdate(rawState: DashboardState): void {
    if (!this.started) return;

    // Hot-reload: sync connections with current config
    this.syncConnections();

    const config = loadRelayConfig();
    if (config.targets.length === 0) return;

    // Get operator info for the transform
    const opConfig = loadOperatorConfig();
    const selfName = getSelfName(opConfig);
    const selfColor = getOperatorColor(0);

    for (const target of config.targets) {
      if (target.projects.length === 0) continue;

      const conn = this.connections.get(target.pylonId);
      if (!conn) continue;

      const state = transformToOperatorState(
        rawState,
        selfName,
        selfColor,
        target.projects,
      );
      conn.sendState(state);
    }
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private syncConnections(): void {
    const config = loadRelayConfig();
    const targetIds = new Set(config.targets.map((t) => t.pylonId));

    // Remove connections for targets no longer in config
    for (const [id, conn] of this.connections) {
      if (!targetIds.has(id)) {
        conn.disconnect();
        this.connections.delete(id);
      }
    }

    // Add/update connections for current targets
    for (const target of config.targets) {
      let conn = this.connections.get(target.pylonId);
      if (!conn) {
        conn = new RelayConnection(target.pylonId, target.wsUrl, target.token);
        this.connections.set(target.pylonId, conn);
        conn.connect();
      } else {
        // Update token in case it changed
        conn.updateToken(target.token);
      }
    }
  }
}

export const relayManager = new RelayManager();
