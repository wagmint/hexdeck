import type { SessionEvent, TurnNode, ToolCallSummary, ParsedSession, SessionInfo } from "../types/index.js";
import { getMessageText, getToolCalls, getToolResults, hasCompaction, getCompactionText } from "../parser/jsonl.js";

/**
 * Build turn-pair nodes from a flat list of session events.
 *
 * A turn = one user message + all assistant messages until the next user message.
 * This is the fundamental unit of a session timeline.
 */
export function buildTurnNodes(events: SessionEvent[]): TurnNode[] {
  const turns: TurnNode[] = [];
  let currentTurnEvents: SessionEvent[] = [];
  let turnIndex = 0;

  for (const event of events) {
    // New user message = start of a new turn
    if (event.message.role === "user" && currentTurnEvents.length > 0) {
      // Flush previous turn
      const turn = buildSingleTurn(currentTurnEvents, turnIndex);
      if (turn) {
        turns.push(turn);
        turnIndex++;
      }
      currentTurnEvents = [];
    }

    currentTurnEvents.push(event);
  }

  // Flush final turn
  if (currentTurnEvents.length > 0) {
    const turn = buildSingleTurn(currentTurnEvents, turnIndex);
    if (turn) turns.push(turn);
  }

  return turns;
}

/**
 * Build a single TurnNode from a group of events (one user msg + assistant responses).
 */
function buildSingleTurn(events: SessionEvent[], index: number): TurnNode | null {
  if (events.length === 0) return null;

  // Find the user message (should be first)
  const userEvent = events.find((e) => e.message.role === "user");
  const userInstruction = userEvent ? getMessageText(userEvent.message) : "";

  // Collect all assistant data
  const allToolCalls: ToolCallSummary[] = [];
  const toolCounts: Record<string, number> = {};
  const filesChanged = new Set<string>();
  const filesRead = new Set<string>();
  let hasCommit = false;
  let commitMessage: string | null = null;
  let hasError = false;
  let turnHasCompaction = false;
  let compactionText: string | null = null;
  let assistantText = "";

  for (const event of events) {
    if (event.message.role !== "assistant") continue;

    // Collect text preview
    const text = getMessageText(event.message);
    if (text && !assistantText) {
      assistantText = text;
    }

    // Collect tool calls
    const calls = getToolCalls(event.message);
    for (const call of calls) {
      allToolCalls.push({ name: call.name, input: call.input });
      toolCounts[call.name] = (toolCounts[call.name] ?? 0) + 1;

      // Detect file changes
      if (call.name === "Write" || call.name === "Edit" || call.name === "NotebookEdit") {
        const filePath = extractFilePath(call.input);
        if (filePath) filesChanged.add(filePath);
      }

      // Detect file reads
      if (call.name === "Read" || call.name === "Glob" || call.name === "Grep") {
        const filePath = extractFilePath(call.input);
        if (filePath) filesRead.add(filePath);
      }

      // Detect git commits
      if (call.name === "Bash") {
        const cmd = extractCommand(call.input);
        if (cmd && isGitCommit(cmd)) {
          hasCommit = true;
          commitMessage = extractCommitMessage(cmd);
        }
      }
    }

    // Check for errors in tool results
    const results = getToolResults(event.message);
    for (const result of results) {
      if (isErrorResult(result.content)) {
        hasError = true;
      }
    }

    // Check for compaction
    if (hasCompaction(event.message)) {
      turnHasCompaction = true;
      compactionText = getCompactionText(event.message);
    }
  }

  return {
    id: `turn-${index}`,
    index,
    userInstruction: userInstruction.slice(0, 500),
    assistantPreview: assistantText.slice(0, 200),
    toolCalls: allToolCalls,
    toolCounts,
    filesChanged: [...filesChanged],
    filesRead: [...filesRead],
    hasCommit,
    commitMessage,
    hasError,
    hasCompaction: turnHasCompaction,
    compactionText,
    events,
    startLine: events[0].line,
    endLine: events[events.length - 1].line,
  };
}

/**
 * Build a full ParsedSession from a SessionInfo and its events.
 */
export function buildParsedSession(session: SessionInfo, events: SessionEvent[]): ParsedSession {
  const turns = buildTurnNodes(events);

  const allFilesChanged = new Set<string>();
  const allToolsUsed: Record<string, number> = {};
  let totalToolCalls = 0;
  let commits = 0;
  let compactions = 0;

  for (const turn of turns) {
    for (const f of turn.filesChanged) allFilesChanged.add(f);
    for (const [tool, count] of Object.entries(turn.toolCounts)) {
      allToolsUsed[tool] = (allToolsUsed[tool] ?? 0) + count;
      totalToolCalls += count;
    }
    if (turn.hasCommit) commits++;
    if (turn.hasCompaction) compactions++;
  }

  return {
    session,
    turns,
    stats: {
      totalEvents: events.length,
      totalTurns: turns.length,
      toolCalls: totalToolCalls,
      commits,
      compactions,
      filesChanged: [...allFilesChanged],
      toolsUsed: Object.fromEntries(
        Object.entries(allToolsUsed).sort((a, b) => b[1] - a[1])
      ),
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractFilePath(input: Record<string, unknown>): string | null {
  if (typeof input.file_path === "string") return input.file_path;
  if (typeof input.path === "string") return input.path;
  if (typeof input.notebook_path === "string") return input.notebook_path;
  return null;
}

function extractCommand(input: Record<string, unknown>): string | null {
  if (typeof input.command === "string") return input.command;
  return null;
}

function isGitCommit(cmd: string): boolean {
  return /git\s+commit/.test(cmd);
}

function extractCommitMessage(cmd: string): string | null {
  // Match: git commit -m "message" or git commit -m 'message'
  const match = cmd.match(/git\s+commit\s+.*?-m\s+["']([^"']+)["']/);
  if (match) return match[1];

  // Match heredoc style: git commit -m "$(cat <<'EOF'\nmessage\nEOF\n)"
  const heredocMatch = cmd.match(/cat\s+<<'?EOF'?\n([\s\S]*?)\nEOF/);
  if (heredocMatch) return heredocMatch[1].trim().split("\n")[0];

  return null;
}

function isErrorResult(content: string): boolean {
  if (typeof content !== "string") return false;
  return (
    content.includes("Error:") ||
    content.includes("error:") ||
    content.includes("ENOENT") ||
    content.includes("EACCES") ||
    content.includes("Exit code") ||
    content.includes("fatal:")
  );
}
