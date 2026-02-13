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
}

export type AgentStatus = "idle" | "busy" | "warning" | "conflict";

export interface Agent {
  sessionId: string;
  label: string;
  status: AgentStatus;
  currentTask: string;
  filesChanged: string[];
  projectPath: string;
  isActive: boolean;
  plan: SessionPlan;
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
  | "start"
  | "plan_started"
  | "plan_approved"
  | "task_completed";

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
