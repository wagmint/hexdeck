import type { SessionEvent, TurnNode, TurnCategory, ToolCallSummary, ParsedSession, SessionInfo, Message } from "../types/index.js";
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
    // New user message with real text = start of a new turn
    // Tool-result-only user messages are part of the current turn (Claude asking for tool results)
    if (event.message.role === "user" && isRealUserMessage(event.message) && currentTurnEvents.length > 0) {
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

  // Find the first real user message (with actual text, not just tool results)
  const userEvent = events.find((e) => e.message.role === "user" && isRealUserMessage(e.message));
  const rawInstruction = userEvent ? getMessageText(userEvent.message) : "";
  const userInstruction = cleanUserInstruction(rawInstruction);
  const { summary, category } = summarizeInstruction(userInstruction);

  // Collect all assistant data
  const allToolCalls: ToolCallSummary[] = [];
  const toolCounts: Record<string, number> = {};
  const filesChanged = new Set<string>();
  const filesRead = new Set<string>();
  const commands: string[] = [];
  let hasCommit = false;
  let commitMessage: string | null = null;
  let errorCount = 0;
  let turnHasCompaction = false;
  let compactionText: string | null = null;
  let assistantText = "";

  for (const event of events) {
    // Check user messages for tool results and errors
    if (event.message.role === "user") {
      const results = getToolResults(event.message);
      for (const result of results) {
        if (isErrorResult(result.content)) {
          errorCount++;
        }
      }
      continue;
    }

    // Process assistant messages for tool calls, text, compaction
    // Collect text preview (skip whitespace-only text)
    const text = getMessageText(event.message).trim();
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

      // Detect bash commands and git commits
      if (call.name === "Bash") {
        const cmd = extractCommand(call.input);
        if (cmd) {
          commands.push(cmd);
          if (isGitCommit(cmd)) {
            hasCommit = true;
            commitMessage = extractCommitMessage(cmd);
          }
        }
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
    summary,
    category,
    userInstruction: userInstruction.slice(0, 500),
    assistantPreview: assistantText.slice(0, 200),
    toolCalls: allToolCalls,
    toolCounts,
    filesChanged: [...filesChanged],
    filesRead: [...filesRead],
    commands,
    hasCommit,
    commitMessage,
    hasError: errorCount > 0,
    errorCount,
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

/**
 * Check if a user message contains real text content (not just tool results or system notifications).
 * Tool-result-only messages are responses to Claude's tool calls, not new user instructions.
 * System notifications (task-notification, system-reminder) are injected by the system.
 */
function isRealUserMessage(message: Message): boolean {
  const text = getRawUserText(message);
  if (!text) return false;
  // Reject pure system notifications that aren't real user input
  if (isSystemOnlyMessage(text)) return false;
  return true;
}

/** Extract raw text from a user message (string content or text blocks). */
function getRawUserText(message: Message): string | null {
  if (typeof message.content === "string") {
    const trimmed = message.content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(message.content)) {
    const texts = message.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text" && "text" in b)
      .map((b) => b.text.trim())
      .filter((t) => t.length > 0);
    return texts.length > 0 ? texts.join("\n") : null;
  }

  return null;
}

/** Tags that indicate a system-injected message, not real user input. */
const SYSTEM_ONLY_TAGS = [
  "task-notification",
  "system-reminder",
];

/** Check if text is purely a system notification (no real user content). */
function isSystemOnlyMessage(text: string): boolean {
  const trimmed = text.trim();
  // Pure system tag messages
  for (const tag of SYSTEM_ONLY_TAGS) {
    if (trimmed.startsWith(`<${tag}>`) || trimmed.startsWith(`<${tag}\n`)) return true;
  }
  return false;
}

/**
 * Clean a user instruction for display — strip system tags, convert to human-readable.
 */
function cleanUserInstruction(raw: string): string {
  let text = raw;

  // Strip <system-reminder>...</system-reminder> blocks
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();

  // Convert <task-notification> to readable summary
  text = text.replace(
    /<task-notification>[\s\S]*?<summary>(.*?)<\/summary>[\s\S]*?<\/task-notification>/g,
    (_, summary) => `[Background task: ${summary.trim()}]`
  );
  // Fallback for task-notification without summary
  text = text.replace(/<task-notification>[\s\S]*?<\/task-notification>/g, "[Background task completed]");

  // Convert slash commands to readable form
  text = text.replace(
    /<command-name>\/?([^<]+)<\/command-name>/g,
    (_, name) => `/${name.trim()}`
  );
  text = text.replace(/<command-message>[^<]*<\/command-message>\s*/g, "");
  text = text.replace(/<command-args>[^<]*<\/command-args>\s*/g, "");

  // Convert local command output to readable form
  text = text.replace(
    /<local-command-caveat>[^<]*<\/local-command-caveat>\s*/g,
    ""
  );
  text = text.replace(
    /<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/g,
    (_, output) => `[Command output: ${output.trim().slice(0, 100)}]`
  );

  // Strip any remaining XML-ish tags that look like system injections
  text = text.replace(/<\/?(?:user-prompt-submit-hook|environment-details|context)[^>]*>/g, "");

  // Clean up [Request interrupted] messages
  text = text.replace(/\[Request interrupted by user(?:\s+for tool use)?\]/g, "[Interrupted by user]");

  // Strip "Read the output file..." boilerplate after task notifications
  text = text.replace(/Read the output file to retrieve the result:.*$/gm, "").trim();

  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

/**
 * Generate a short summary and category from a cleaned user instruction.
 */
function summarizeInstruction(text: string): { summary: string; category: TurnCategory } {
  const trimmed = text.trim();

  // Empty / no real content
  if (!trimmed) {
    return { summary: "(continuation)", category: "continuation" };
  }

  // System-generated patterns
  if (trimmed.startsWith("[Interrupted")) {
    return { summary: "Interrupted", category: "interruption" };
  }
  if (trimmed.startsWith("[Background task")) {
    return { summary: trimmed.slice(1, trimmed.indexOf("]")), category: "system" };
  }
  if (trimmed.startsWith("[Command output")) {
    const output = trimmed.match(/\[Command output: (.*?)\]/)?.[1] ?? "command output";
    return { summary: output.slice(0, 80), category: "command" };
  }

  // Slash commands
  if (trimmed.startsWith("/")) {
    return { summary: trimmed.split("\n")[0].slice(0, 40), category: "command" };
  }

  // Very short continuations: "yes", "ok", "continue", "try again", etc.
  if (trimmed.length <= 20) {
    const lower = trimmed.toLowerCase();
    const continuationWords = ["yes", "ok", "okay", "continue", "go", "sure", "yeah", "yep", "do it", "try again", "yes save it", "yes please"];
    if (continuationWords.some((w) => lower === w || lower.startsWith(w + " "))) {
      return { summary: trimmed, category: "continuation" };
    }
  }

  // Terminal paste / context sharing (starts with common prompt patterns or has lots of $)
  if (/^\(base\)|^\$|^MacBook|^➜|^root@/.test(trimmed) || trimmed.startsWith("(base)")) {
    const firstLine = trimmed.split("\n")[0].slice(0, 80);
    return { summary: `Terminal: ${firstLine}`, category: "context" };
  }

  // "This session is being continued from..." — context resumption
  if (trimmed.startsWith("This session is being continued")) {
    return { summary: "Session continuation with context", category: "context" };
  }

  // Markdown plan/document — extract first heading
  const headingMatch = trimmed.match(/^#+ +(.+)/m);
  if (headingMatch && trimmed.length > 200) {
    return { summary: headingMatch[1].slice(0, 80), category: "task" };
  }

  // Now categorize by content
  const lower = trimmed.toLowerCase();
  const firstSentence = extractFirstSentence(trimmed);

  // Questions
  if (firstSentence.endsWith("?") || /^(how|what|why|when|where|which|can you explain|do you|is there|does)/i.test(trimmed)) {
    return { summary: firstSentence.slice(0, 80), category: "question" };
  }

  // Feedback/fix patterns
  if (/^(fix|this is wrong|that's wrong|change|update|modify|instead|actually|no,|but )/i.test(trimmed)) {
    return { summary: firstSentence.slice(0, 80), category: "feedback" };
  }

  // Task patterns
  if (/^(implement|build|create|add|write|make|set up|install|deploy|run|start|configure|can you)/i.test(trimmed)) {
    return { summary: firstSentence.slice(0, 80), category: "task" };
  }

  // Export/save patterns
  if (/^(export|save|capture|import|read|load|pull|fetch)/i.test(trimmed)) {
    return { summary: firstSentence.slice(0, 80), category: "task" };
  }

  // If first sentence is very short and there's more content, try to grab more context
  if (firstSentence.length < 30 && trimmed.length > firstSentence.length + 10) {
    const extended = extractFirstSentence(trimmed.slice(firstSentence.length).trim());
    if (extended.length > 5) {
      const combined = firstSentence + " " + extended;
      return { summary: combined.slice(0, 80), category: "conversation" };
    }
  }

  // Default: use first sentence, categorize as conversation
  return { summary: firstSentence.slice(0, 80), category: "conversation" };
}

/** Extract the first sentence (up to first period, question mark, or newline). */
function extractFirstSentence(text: string): string {
  // Take first line
  const firstLine = text.split("\n")[0].trim();

  // Try to find sentence boundary
  const sentenceEnd = firstLine.search(/[.!?](\s|$)/);
  if (sentenceEnd > 0 && sentenceEnd < 120) {
    return firstLine.slice(0, sentenceEnd + 1);
  }

  // No sentence boundary found — truncate at word boundary
  if (firstLine.length > 80) {
    const truncated = firstLine.slice(0, 80);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + "...";
  }

  return firstLine;
}

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
  // Match heredoc style first (most common in Claude Code):
  // git commit -m "$(cat <<'EOF'\nmessage\n\nCo-Authored-By: ...\nEOF\n)"
  const heredocMatch = cmd.match(/cat\s+<<'?EOF'?\n([\s\S]*?)\n\s*EOF/);
  if (heredocMatch) {
    // Take first non-empty line as the commit message summary
    const lines = heredocMatch[1].trim().split("\n");
    const summary = lines.find((l) => l.trim().length > 0 && !l.startsWith("Co-Authored-By:"));
    return summary?.trim() ?? null;
  }

  // Match: git commit -m "message" or git commit -m 'message'
  const match = cmd.match(/git\s+commit\s+.*?-m\s+["']([^"']+)["']/);
  if (match) return match[1];

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
