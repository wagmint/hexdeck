// ─── Risk Types ──────────────────────────────────────────────────────────────

export type RiskLevel = "nominal" | "elevated" | "critical";

export interface SpinningSignal {
  pattern: string;
  level: RiskLevel;
  detail: string;
}

export interface AgentRisk {
  errorRate: number;
  correctionRatio: number;
  totalTokens: number;
  compactions: number;
  compactionProximity: RiskLevel;
  fileHotspots: Array<{ file: string; count: number }>;
  spinningSignals: SpinningSignal[];
  overallRisk: RiskLevel;
  errorTrend: boolean[];
}

export interface WorkstreamRisk {
  errorRate: number;
  totalTokens: number;
  riskyAgents: number;
  overallRisk: RiskLevel;
}

// ─── Dashboard Types (frontend mirrors — dates as strings) ──────────────────

export type PlanStatus = "drafting" | "approved" | "implementing" | "completed" | "none";

export interface PlanTask {
  id: string;
  subject: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "deleted";
}

export interface SessionPlan {
  status: PlanStatus;
  markdown: string | null;
  tasks: PlanTask[];
  agentLabel: string;
  timestamp: string;
}

export type AgentStatus = "idle" | "busy" | "warning" | "conflict";

export type AgentType = "claude" | "codex";

export interface Agent {
  sessionId: string;
  label: string;
  agentType: AgentType;
  status: AgentStatus;
  currentTask: string;
  filesChanged: string[];
  projectPath: string;
  isActive: boolean;
  plan: SessionPlan;
  risk: AgentRisk;
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
  plans: SessionPlan[];
  planTasks: PlanTask[];
  risk: WorkstreamRisk;
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
  | "collision_resolved"
  | "completion"
  | "error"
  | "compaction"
  | "start"
  | "plan_started"
  | "plan_approved"
  | "task_completed"
  | "session_ended";

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
  agentsAtRisk: number;
}

export interface DashboardState {
  agents: Agent[];
  workstreams: Workstream[];
  collisions: Collision[];
  feed: FeedEvent[];
  summary: DashboardSummary;
}
