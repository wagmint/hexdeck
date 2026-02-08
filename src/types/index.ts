// ─── Claude Code JSONL Event Types ───────────────────────────────────────────

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

export interface CompactionContent {
  type: "compaction";
  content: string;
}

export type ContentBlock =
  | TextContent
  | ToolUseContent
  | ToolResultContent
  | CompactionContent;

export interface Message {
  role: "user" | "assistant";
  content: ContentBlock[] | string;
}

export interface SessionEvent {
  /** Line number in the JSONL file (0-indexed) */
  line: number;
  /** The parsed message */
  message: Message;
}

// ─── Session Discovery Types ─────────────────────────────────────────────────

export interface SessionInfo {
  /** Session UUID */
  id: string;
  /** Full path to the JSONL file */
  path: string;
  /** Project path this session belongs to */
  projectPath: string;
  /** File creation time */
  createdAt: Date;
  /** File modification time */
  modifiedAt: Date;
  /** File size in bytes */
  sizeBytes: number;
}

export interface ProjectInfo {
  /** Encoded project directory name (as stored by Claude Code) */
  encodedName: string;
  /** Decoded original path */
  decodedPath: string;
  /** Number of sessions */
  sessionCount: number;
  /** Most recent session date */
  lastActive: Date;
}

// ─── Tree Types (core data model) ────────────────────────────────────────────

export type NodeType =
  | "user_instruction"
  | "implementation"
  | "commit"
  | "compaction"
  | "error"
  | "decision_point"
  | "checkpoint";

export type NodeStatus = "good" | "uncertain" | "off_rails" | "checkpoint";

export interface Decision {
  what: string;
  why: string;
  alternatives: string[];
}

export interface TreeNode {
  id: string;
  sessionId: string;
  parentId: string | null;
  children: string[];
  branchId: string | null;

  /** Position in transcript */
  transcriptLine: number;
  timestamp: string;
  depth: number;

  /** Classification */
  type: NodeType;
  summary: string;

  /** State at this point */
  gitRef: string | null;
  filesChanged: string[];
  tokenCount: number;

  /** Decisions made at this node */
  decisions: Decision[];

  /** Visualization */
  status: NodeStatus;
  confidence: number;
}

export interface Branch {
  id: string;
  name: string;
  sourceNodeId: string;
  sessionId: string;
  createdAt: string;
  status: "active" | "merged" | "abandoned";
}

export interface CompactionSnapshot {
  id: string;
  nodeId: string;
  sessionId: string;
  preCompactSummary: string;
  decisionsSoFar: Decision[];
  activeTasks: string[];
  filesState: string;
  tokenCountBefore: number;
  createdAt: string;
}

export interface ResumeEvent {
  id: string;
  sourceNodeId: string;
  newSessionId: string;
  resumeMethod: "jsonl_truncate" | "briefing" | "hybrid";
  createdAt: string;
}

export interface SessionTree {
  sessionId: string;
  projectPath: string;
  nodes: TreeNode[];
  branches: Branch[];
  compactionSnapshots: CompactionSnapshot[];
  resumeEvents: ResumeEvent[];
  createdAt: string;
  updatedAt: string;
}

// ─── Turn-Pair Node Types (v0 data model) ───────────────────────────────────

export interface ToolCallSummary {
  name: string;
  input: Record<string, unknown>;
}

export interface TurnNode {
  id: string;
  index: number;

  /** The user's instruction text */
  userInstruction: string;
  /** Preview of Claude's response text (first ~200 chars) */
  assistantPreview: string;

  /** Tool calls made during this turn */
  toolCalls: ToolCallSummary[];
  /** Aggregated tool usage: tool name → count */
  toolCounts: Record<string, number>;

  /** Files written or edited */
  filesChanged: string[];
  /** Files read */
  filesRead: string[];

  /** Git commit info */
  hasCommit: boolean;
  commitMessage: string | null;

  /** Error and compaction flags */
  hasError: boolean;
  hasCompaction: boolean;
  compactionText: string | null;

  /** Raw events for this turn (for drill-down) */
  events: SessionEvent[];

  /** Position in the JSONL */
  startLine: number;
  endLine: number;
}

export interface ParsedSession {
  session: SessionInfo;
  turns: TurnNode[];
  stats: {
    totalEvents: number;
    totalTurns: number;
    toolCalls: number;
    commits: number;
    compactions: number;
    filesChanged: string[];
    toolsUsed: Record<string, number>;
  };
}
