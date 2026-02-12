// ─── Dashboard Types (frontend mirrors — dates as strings) ──────────────────

export type AgentStatus = "idle" | "busy" | "warning" | "conflict";

export interface Agent {
  sessionId: string;
  label: string;
  status: AgentStatus;
  currentTask: string;
  filesChanged: string[];
  projectPath: string;
  isActive: boolean;
}

export interface Workstream {
  projectId: string;
  projectPath: string;
  name: string;
  agents: Agent[];
  completionPct: number;
  totalTurns: number;
  completedTurns: number;
  hasCollision: boolean;
  commits: number;
  errors: number;
}

export type CollisionSeverity = "warning" | "critical";

export interface Collision {
  id: string;
  filePath: string;
  agents: {
    sessionId: string;
    label: string;
    projectPath: string;
    lastAction: string;
  }[];
  severity: CollisionSeverity;
  detectedAt: string;
}

export type FeedEventType =
  | "collision"
  | "completion"
  | "error"
  | "compaction"
  | "start";

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  timestamp: string;
  agentLabel: string;
  sessionId: string;
  projectPath: string;
  message: string;
  collisionId?: string;
}

export interface DashboardSummary {
  totalAgents: number;
  activeAgents: number;
  totalCollisions: number;
  criticalCollisions: number;
  totalWorkstreams: number;
  totalCommits: number;
  totalErrors: number;
}

export interface DashboardState {
  agents: Agent[];
  workstreams: Workstream[];
  collisions: Collision[];
  feed: FeedEvent[];
  summary: DashboardSummary;
}
