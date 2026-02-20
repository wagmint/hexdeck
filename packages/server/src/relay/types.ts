// ─── Relay Protocol Types ───────────────────────────────────────────────────
// Mirrors cloud's OperatorState shape independently (pylon can't import from pylon-cloud).

// ─── Relay State Types ──────────────────────────────────────────────────────

export interface RelayAgent {
  sessionId: string;
  label: string;
  agentType: "claude" | "codex";
  status: "idle" | "busy" | "warning" | "conflict";
  currentTask: string;
  filesChanged: string[];
  projectPath: string;
  isActive: boolean;
  planStatus: "drafting" | "implementing" | "completed" | "rejected" | "none";
  planTaskProgress: string | null; // e.g. "3/5"
  operatorId: string;
}

export interface RelayWorkstream {
  projectId: string;
  projectPath: string;
  name: string;
  agentSessionIds: string[];
  completionPct: number;
  totalTurns: number;
  completedTurns: number;
  hasCollision: boolean;
  commits: number;
  errors: number;
  risk: { errorRate: number; overallRisk: "nominal" | "elevated" | "critical" };
}

export interface RelayCollision {
  id: string;
  filePath: string;
  agents: {
    sessionId: string;
    label: string;
    projectPath: string;
    lastAction: string;
    operatorId: string;
  }[];
  severity: "warning" | "critical";
  isCrossOperator: boolean;
  detectedAt: string; // ISO
}

export type RelayFeedEventType =
  | "collision"
  | "collision_resolved"
  | "completion"
  | "error"
  | "compaction"
  | "start"
  | "plan_started"
  | "plan_approved"
  | "task_completed"
  | "session_ended"
  | "stall"
  | "idle";

export interface RelayFeedEvent {
  id: string;
  type: RelayFeedEventType;
  timestamp: string; // ISO
  agentLabel: string;
  sessionId: string;
  projectPath: string;
  message: string;
  operatorId: string;
  collisionId?: string;
}

export interface OperatorState {
  operator: {
    id: string;
    name: string;
    color: string;
  };
  agents: RelayAgent[];
  workstreams: RelayWorkstream[];
  collisions: RelayCollision[];
  feed: RelayFeedEvent[];
}

// ─── WebSocket Protocol ─────────────────────────────────────────────────────

// Client → Server messages
export interface AuthMessage {
  type: "auth";
  token: string;
  pylonId: string;
}

export interface StateUpdateMessage {
  type: "state_update";
  state: OperatorState;
}

export interface HeartbeatMessage {
  type: "heartbeat";
}

export type ClientMessage = AuthMessage | StateUpdateMessage | HeartbeatMessage;

// Server → Client messages
export interface AuthOkMessage {
  type: "auth_ok";
  operatorId: string;
}

export interface AuthErrorMessage {
  type: "auth_error";
  reason: string;
}

export type ServerMessage = AuthOkMessage | AuthErrorMessage;

// ─── Relay Config Types ─────────────────────────────────────────────────────

export interface RelayTarget {
  pylonId: string;
  pylonName: string;
  wsUrl: string;
  token: string;
  refreshToken: string;
  projects: string[];
  addedAt: string; // ISO
}

export interface RelayConfig {
  targets: RelayTarget[];
}
