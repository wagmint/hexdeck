import type { DashboardState } from "../types/index.js";
import { loadOperatorConfig, getSelfName, getOperatorColor } from "../core/config.js";
import { loadRelayConfig, saveRelayConfig } from "./config.js";
import { transformToOperatorState } from "./transform.js";
import { RelayConnection } from "./connection.js";
import type { RelayConnectionStatus } from "./connection.js";
import type { RelayTarget } from "./types.js";

export interface RelayTargetStatus {
  hexcoreId: string;
  hexcoreName: string;
  status: RelayConnectionStatus;
  projects: string[];
  addedAt: string;
}

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

  /** Get status for all configured targets with live connection info. */
  getStatus(): RelayTargetStatus[] {
    const config = loadRelayConfig();
    return config.targets.map((t) => {
      const conn = this.connections.get(t.hexcoreId);
      return {
        hexcoreId: t.hexcoreId,
        hexcoreName: t.hexcoreName,
        status: conn ? conn.status : "disconnected",
        projects: t.projects,
        addedAt: t.addedAt,
      };
    });
  }

  /** Add or update a relay target from parsed connect link fields. */
  addTarget(fields: { hexcoreId: string; hexcoreName: string; wsUrl: string; token: string; refreshToken: string }): void {
    const config = loadRelayConfig();
    const existing = config.targets.find((t) => t.hexcoreId === fields.hexcoreId);
    if (existing) {
      existing.token = fields.token;
      existing.refreshToken = fields.refreshToken;
      existing.hexcoreName = fields.hexcoreName;
      existing.wsUrl = fields.wsUrl;
    } else {
      const target: RelayTarget = {
        hexcoreId: fields.hexcoreId,
        hexcoreName: fields.hexcoreName,
        wsUrl: fields.wsUrl,
        token: fields.token,
        refreshToken: fields.refreshToken,
        projects: [],
        addedAt: new Date().toISOString(),
      };
      config.targets.push(target);
    }
    saveRelayConfig(config);
    if (this.started) this.syncConnections();
  }

  /** Remove a relay target and disconnect. */
  removeTarget(hexcoreId: string): boolean {
    const config = loadRelayConfig();
    const idx = config.targets.findIndex((t) => t.hexcoreId === hexcoreId);
    if (idx === -1) return false;
    config.targets.splice(idx, 1);
    saveRelayConfig(config);
    const conn = this.connections.get(hexcoreId);
    if (conn) {
      conn.disconnect();
      this.connections.delete(hexcoreId);
    }
    return true;
  }

  /** Add a project to a relay target. */
  includeProject(hexcoreId: string, projectPath: string): boolean {
    const config = loadRelayConfig();
    const target = config.targets.find((t) => t.hexcoreId === hexcoreId);
    if (!target) return false;
    if (target.projects.includes(projectPath)) return true;
    target.projects.push(projectPath);
    saveRelayConfig(config);
    return true;
  }

  /** Remove a project from a relay target. */
  excludeProject(hexcoreId: string, projectPath: string): boolean {
    const config = loadRelayConfig();
    const target = config.targets.find((t) => t.hexcoreId === hexcoreId);
    if (!target) return false;
    const idx = target.projects.indexOf(projectPath);
    if (idx === -1) return true;
    target.projects.splice(idx, 1);
    saveRelayConfig(config);
    return true;
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

      const conn = this.connections.get(target.hexcoreId);
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

  /** Persist a refreshed access token back to relay.json */
  private handleTokenRefreshed(hexcoreId: string, newToken: string): void {
    const config = loadRelayConfig();
    const target = config.targets.find((t) => t.hexcoreId === hexcoreId);
    if (target) {
      target.token = newToken;
      saveRelayConfig(config);
    }
  }

  private syncConnections(): void {
    const config = loadRelayConfig();
    const targetIds = new Set(config.targets.map((t) => t.hexcoreId));

    // Remove connections for targets no longer in config
    for (const [id, conn] of this.connections) {
      if (!targetIds.has(id)) {
        conn.disconnect();
        this.connections.delete(id);
      }
    }

    // Add/update connections for current targets
    for (const target of config.targets) {
      let conn = this.connections.get(target.hexcoreId);
      if (!conn) {
        conn = new RelayConnection(
          target.hexcoreId,
          target.wsUrl,
          target.token,
          target.refreshToken,
          this.handleTokenRefreshed.bind(this),
        );
        this.connections.set(target.hexcoreId, conn);
        conn.connect();
      } else {
        // Update tokens in case they changed
        conn.updateToken(target.token);
        conn.updateRefreshToken(target.refreshToken);
      }
    }
  }
}

export const relayManager = new RelayManager();
