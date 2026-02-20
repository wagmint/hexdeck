import WebSocket from "ws";
import type {
  OperatorState,
  AuthMessage,
  StateUpdateMessage,
  HeartbeatMessage,
  ServerMessage,
} from "./types.js";

const HEARTBEAT_INTERVAL_MS = 20_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export type RelayConnectionStatus = "connected" | "connecting" | "disconnected";

/** Callback to persist refreshed token back to config */
export type OnTokenRefreshed = (pylonId: string, newToken: string) => void;

export class RelayConnection {
  readonly pylonId: string;

  private wsUrl: string;
  private token: string;
  private refreshToken: string;
  private onTokenRefreshed: OnTokenRefreshed | null;
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private authenticated = false;
  private operatorId: string | null = null;
  private lastStateJson = "";
  private intentionalClose = false;
  private refreshing = false;

  constructor(
    pylonId: string,
    wsUrl: string,
    token: string,
    refreshToken: string = "",
    onTokenRefreshed: OnTokenRefreshed | null = null,
  ) {
    this.pylonId = pylonId;
    this.wsUrl = wsUrl;
    this.token = token;
    this.refreshToken = refreshToken;
    this.onTokenRefreshed = onTokenRefreshed;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }

  get status(): RelayConnectionStatus {
    if (this.intentionalClose) return "disconnected";
    if (this.authenticated && this.ws?.readyState === WebSocket.OPEN) return "connected";
    return "connecting";
  }

  /** Update token (e.g. after config change). Takes effect on next reconnect. */
  updateToken(token: string): void {
    this.token = token;
  }

  /** Update refresh token (e.g. after config change). */
  updateRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
  }

  connect(): void {
    this.intentionalClose = false;
    this.doConnect();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.cleanup();
  }

  sendState(state: OperatorState): void {
    if (!this.isConnected) return;

    const json = JSON.stringify(state);
    if (json === this.lastStateJson) return;
    this.lastStateJson = json;

    const msg: StateUpdateMessage = { type: "state_update", state };
    this.send(msg);
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private doConnect(): void {
    this.cleanup();
    if (this.intentionalClose) return;

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.reconnectAttempt = 0;

      // Send auth
      const authMsg: AuthMessage = {
        type: "auth",
        token: this.token,
        pylonId: this.pylonId,
      };
      this.send(authMsg);

      // Start heartbeat
      this.heartbeatTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          const hb: HeartbeatMessage = { type: "heartbeat" };
          this.send(hb);
        }
      }, HEARTBEAT_INTERVAL_MS);
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ServerMessage;
        if (msg.type === "auth_ok") {
          this.authenticated = true;
          this.operatorId = msg.operatorId;
        } else if (msg.type === "auth_error") {
          const reason = (msg as { reason?: string; message?: string }).reason
            ?? (msg as { message?: string }).message ?? "unknown";
          console.error(`[relay] Auth failed for ${this.pylonId}: ${reason}`);

          // If token expired and we have a refresh token, try refreshing
          if (reason.toLowerCase().includes("expired") && this.refreshToken) {
            this.tryTokenRefresh();
          } else {
            this.disconnect();
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    this.ws.on("close", () => {
      this.authenticated = false;
      this.stopHeartbeat();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", () => {
      // Error always followed by close event — reconnect handled there
    });
  }

  private async tryTokenRefresh(): Promise<void> {
    if (this.refreshing || this.intentionalClose) return;
    this.refreshing = true;

    try {
      // Derive HTTP URL from WS URL: ws(s)://host/ws → http(s)://host
      const httpUrl = this.wsUrl
        .replace(/^wss:/, "https:")
        .replace(/^ws:/, "http:")
        .replace(/\/ws\/?$/, "");

      const res = await fetch(`${httpUrl}/api/auth/relay-refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!res.ok) {
        console.error(`[relay] Token refresh failed for ${this.pylonId}: ${res.status}`);
        this.disconnect();
        return;
      }

      const body = await res.json() as { success: boolean; data?: { accessToken: string } };
      if (!body.success || !body.data?.accessToken) {
        console.error(`[relay] Token refresh returned invalid response for ${this.pylonId}`);
        this.disconnect();
        return;
      }

      this.token = body.data.accessToken;

      // Persist the new token back to config
      if (this.onTokenRefreshed) {
        this.onTokenRefreshed(this.pylonId, this.token);
      }

      console.log(`[relay] Token refreshed for ${this.pylonId}, reconnecting`);
      this.reconnectAttempt = 0;
      this.doConnect();
    } catch (err) {
      console.error(`[relay] Token refresh error for ${this.pylonId}:`, err);
      this.scheduleReconnect();
    } finally {
      this.refreshing = false;
    }
  }

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;

    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.authenticated = false;
    this.lastStateJson = "";
  }
}
