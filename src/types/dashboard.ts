// ─── Dashboard Types ─────────────────────────────────────────────────────────

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
  /** Session ID */
  sessionId: string;
  /** Label within its project (agent-1, agent-2...) */
  label: string;
  /** Current status */
  status: AgentStatus;
  /** Short description of current activity */
  currentTask: string;
  /** Files this agent has changed */
  filesChanged: string[];
  /** Project path this agent belongs to */
  projectPath: string;
  /** Whether this agent is currently active (has running process) */
  isActive: boolean;
  /** Plan state for this agent's session */
  plan: SessionPlan;
}

export interface Workstream {
  /** Encoded project name */
  projectId: string;
  /** Decoded project path */
  projectPath: string;
  /** Short display name (last path segment) */
  name: string;
  /** Agents working in this project */
  agents: Agent[];
  /** Completion percentage (completed turns / total turns) */
  completionPct: number;
  /** Total turns across all sessions */
  totalTurns: number;
  /** Turns with commits or completed work */
  completedTurns: number;
  /** Whether this workstream has collisions */
  hasCollision: boolean;
  /** Total commits across sessions */
  commits: number;
  /** Total errors across sessions */
  errors: number;
  /** Plans from agent sessions in this workstream */
  plans: SessionPlan[];
  /** Flattened tasks across all sessions */
  planTasks: PlanTask[];
}

export type CollisionSeverity = "warning" | "critical";

export interface Collision {
  /** Unique ID for this collision */
  id: string;
  /** The file path that has a collision */
  filePath: string;
  /** Agents involved in the collision */
  agents: {
    sessionId: string;
    label: string;
    projectPath: string;
    /** What this agent last did to the file */
    lastAction: string;
  }[];
  /** Severity: critical if cross-project, warning if same project */
  severity: CollisionSeverity;
  /** Display timestamp */
  detectedAt: Date;
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
  | "task_completed";

export interface FeedEvent {
  /** Unique ID for deduplication */
  id: string;
  /** Event type */
  type: FeedEventType;
  /** Display timestamp */
  timestamp: Date;
  /** Agent label (e.g. agent-1) */
  agentLabel: string;
  /** Session ID */
  sessionId: string;
  /** Project path */
  projectPath: string;
  /** Human-readable message */
  message: string;
  /** Optional: collision ID if type is collision */
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
