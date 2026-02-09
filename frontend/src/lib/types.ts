export interface ProjectInfo {
  encodedName: string;
  decodedPath: string;
  sessionCount: number;
  lastActive: string;
}

export interface SessionInfo {
  id: string;
  projectPath: string;
  createdAt: string;
  modifiedAt: string;
  sizeBytes: number;
}

export type TurnCategory =
  | "task"
  | "question"
  | "feedback"
  | "command"
  | "continuation"
  | "interruption"
  | "context"
  | "system"
  | "conversation";

export interface TurnNode {
  id: string;
  index: number;
  summary: string;
  category: TurnCategory;
  userInstruction: string;
  assistantPreview: string;
  toolCounts: Record<string, number>;
  filesChanged: string[];
  filesRead: string[];
  commands: string[];
  hasCommit: boolean;
  commitMessage: string | null;
  hasError: boolean;
  errorCount: number;
  hasCompaction: boolean;
  compactionText: string | null;
  startLine: number;
  endLine: number;
}

export interface SessionStats {
  totalEvents: number;
  totalTurns: number;
  toolCalls: number;
  commits: number;
  compactions: number;
  filesChanged: string[];
  toolsUsed: Record<string, number>;
}

export interface ParsedSession {
  session: SessionInfo;
  turns: TurnNode[];
  stats: SessionStats;
}
