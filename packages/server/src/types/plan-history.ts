import type { PlanStatus, PlanTask, AgentType } from "./dashboard.js";

export interface PlanTaskCounts {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export interface PlanHistoryItem {
  planId: string;
  sessionId: string;
  projectPath: string;
  agentType: AgentType;
  status: PlanStatus;
  timestamp: Date;
  title: string;
  taskCounts: PlanTaskCounts;
  durationMs: number | null;
}

export interface PlanHistoryDetailItem extends PlanHistoryItem {
  markdown: string | null;
  tasks: PlanTask[];
}

export interface PlanHistoryCursor {
  timestampMs: number;
  planId: string;
}

export interface PlanHistoryQuery {
  cursor?: string;
  limit?: number;
  projectPath?: string;
  sessionId?: string;
  status?: PlanStatus;
  from?: string;
  to?: string;
}

export interface PlanHistoryPage {
  items: PlanHistoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SessionPlanHistory {
  sessionId: string;
  projectPath: string;
  agentType: AgentType;
  plans: PlanHistoryDetailItem[];
}

export interface PlanHistoryRefreshResult {
  scanned: boolean;
  parsedSessions: number;
  droppedSessions: number;
  remainingDirtySessions: number;
  updatedAt: string;
}
