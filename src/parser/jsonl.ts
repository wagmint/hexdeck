import { readFileSync } from "fs";
import type { SessionEvent, Message, ContentBlock } from "../types/index.js";

/**
 * Parse a Claude Code session JSONL file into a stream of events.
 * Each line in the JSONL is a message event (user or assistant).
 */
export function parseSessionFile(filePath: string): SessionEvent[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  const events: SessionEvent[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]);
      const message = normalizeMessage(parsed);
      if (message) {
        events.push({ line: i, message });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return events;
}

/**
 * Normalize various JSONL line formats into a standard Message.
 * Claude Code JSONL may contain different event shapes.
 */
function normalizeMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;

  // Standard message format: { role: "user"|"assistant", content: ... }
  if (obj.role && (obj.role === "user" || obj.role === "assistant")) {
    return {
      role: obj.role as "user" | "assistant",
      content: normalizeContent(obj.content),
    };
  }

  // Some JSONL formats wrap in a message field
  if (obj.message && typeof obj.message === "object") {
    return normalizeMessage(obj.message);
  }

  // Event wrapper format: { type: "message", message: { ... } }
  if (obj.type === "message" && obj.message) {
    return normalizeMessage(obj.message);
  }

  return null;
}

/**
 * Normalize content field which can be a string or array of content blocks.
 */
function normalizeContent(content: unknown): ContentBlock[] | string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content.filter(isValidContentBlock);
  }

  return [];
}

function isValidContentBlock(block: unknown): block is ContentBlock {
  if (!block || typeof block !== "object") return false;
  const obj = block as Record<string, unknown>;
  return (
    obj.type === "text" ||
    obj.type === "tool_use" ||
    obj.type === "tool_result" ||
    obj.type === "compaction" ||
    obj.type === "thinking"
  );
}

// ─── Extraction helpers ──────────────────────────────────────────────────────

/**
 * Get all text content from a message (concatenates all text blocks).
 */
export function getMessageText(message: Message): string {
  if (typeof message.content === "string") return message.content;

  return message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/**
 * Get all tool_use blocks from a message.
 */
export function getToolCalls(
  message: Message
): Array<{ type: "tool_use"; id: string; name: string; input: Record<string, unknown> }> {
  if (typeof message.content === "string") return [];

  return message.content.filter(
    (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      b.type === "tool_use"
  );
}

/**
 * Get all tool_result blocks from a message.
 */
export function getToolResults(
  message: Message
): Array<{ type: "tool_result"; tool_use_id: string; content: string }> {
  if (typeof message.content === "string") return [];

  return message.content.filter(
    (b): b is { type: "tool_result"; tool_use_id: string; content: string } =>
      b.type === "tool_result"
  );
}

/**
 * Check if a message contains a compaction block.
 */
export function hasCompaction(message: Message): boolean {
  if (typeof message.content === "string") return false;
  return message.content.some((b) => b.type === "compaction");
}

/**
 * Get the compaction summary text if present.
 */
export function getCompactionText(message: Message): string | null {
  if (typeof message.content === "string") return null;

  const block = message.content.find(
    (b): b is { type: "compaction"; content: string } => b.type === "compaction"
  );

  return block?.content ?? null;
}

/**
 * Get basic stats about a parsed session.
 */
export function getSessionStats(events: SessionEvent[]) {
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let compactions = 0;
  const toolsUsed = new Map<string, number>();

  for (const event of events) {
    if (event.message.role === "user") userMessages++;
    if (event.message.role === "assistant") assistantMessages++;

    const calls = getToolCalls(event.message);
    toolCalls += calls.length;
    for (const call of calls) {
      toolsUsed.set(call.name, (toolsUsed.get(call.name) ?? 0) + 1);
    }

    if (hasCompaction(event.message)) compactions++;
  }

  return {
    totalEvents: events.length,
    userMessages,
    assistantMessages,
    toolCalls,
    compactions,
    toolsUsed: Object.fromEntries(
      [...toolsUsed.entries()].sort((a, b) => b[1] - a[1])
    ),
  };
}
