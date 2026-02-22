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

export interface GoalSection {
  summary: string;
  fullInstruction: string;
}

export interface ApproachSection {
  summary: string;
  thinking: string;
}

export interface DecisionItem {
  choice: string;
  reasoning: string;
}

export interface DecisionsSection {
  summary: string;
  items: DecisionItem[];
}

export interface ResearchSection {
  summary: string;
  filesRead: string[];
  searches: string[];
}

export interface ActionsSection {
  summary: string;
  edits: string[];
  commands: string[];
  creates: string[];
}

export interface CorrectionItem {
  error: string;
  fix: string;
}

export interface CorrectionsSection {
  summary: string;
  items: CorrectionItem[];
}

export interface ArtifactsSection {
  summary: string;
  filesChanged: string[];
  commits: string[];
}

export interface EscalationsSection {
  summary: string;
  questions: string[];
}

export interface TurnSections {
  goal: GoalSection;
  approach: ApproachSection;
  decisions: DecisionsSection;
  research: ResearchSection;
  actions: ActionsSection;
  corrections: CorrectionsSection;
  artifacts: ArtifactsSection;
  escalations: EscalationsSection;
}

export interface TurnNode {
  id: string;
  index: number;
  summary: string;
  category: TurnCategory;
  userInstruction: string;
  assistantPreview: string;
  sections: TurnSections;
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
  cost: number;
  model: string | null;
}

export interface SessionStats {
  totalEvents: number;
  totalTurns: number;
  toolCalls: number;
  commits: number;
  compactions: number;
  filesChanged: string[];
  toolsUsed: Record<string, number>;
  totalCost: number;
}

export interface ParsedSession {
  session: SessionInfo;
  turns: TurnNode[];
  stats: SessionStats;
}
