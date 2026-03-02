import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { getActiveSessions } from "../discovery/sessions.js";

// ─── In-memory blocked session store ────────────────────────────────────────

export interface BlockedInfo {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  blockedAt: number;
  /** JSONL file size (bytes) when the hook was received. Used to detect user response. */
  snapshotSize: number;
}

export const blockedSessions = new Map<string, BlockedInfo>();

/** Max age before a blocked entry is auto-purged (safety net for crashed sessions) */
const BLOCKED_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Auto-clear stale blocked entries. Called each ticker cycle before buildDashboardState().
 * - Clears when appended JSONL data shows unblock evidence (tool_result or user message)
 * - Purges entries for sessions no longer active
 * - Purges entries older than TTL
 */
export function clearStaleBlocked(): void {
  if (blockedSessions.size === 0) return;

  const now = Date.now();
  const activeSessions = getActiveSessions();
  const activeIds = new Set(activeSessions.map(s => s.id));
  const activeByIdMap = new Map(activeSessions.map(s => [s.id, s]));

  for (const [sessionId, info] of blockedSessions) {
    // Purge if session is no longer active
    if (!activeIds.has(sessionId)) {
      blockedSessions.delete(sessionId);
      continue;
    }

    // Purge if older than TTL
    if (now - info.blockedAt > BLOCKED_TTL_MS) {
      blockedSessions.delete(sessionId);
      continue;
    }

    // Clear only when appended transcript data contains unblock evidence.
    // Plain file growth alone is not reliable: Claude Code may append
    // internal/status lines while still waiting for user input.
    const session = activeByIdMap.get(sessionId);
    if (session) {
      try {
        const currentSize = statSync(session.path).size;
        if (
          info.snapshotSize > 0
          && currentSize > info.snapshotSize
          && hasUnblockEvidence(session.path, info.snapshotSize)
        ) {
          blockedSessions.delete(sessionId);
        }
      } catch {
        // File gone — purge
        blockedSessions.delete(sessionId);
      }
    }
  }
}

function hasUnblockEvidence(transcriptPath: string, snapshotSize: number): boolean {
  try {
    const buf = readFileSync(transcriptPath);
    if (snapshotSize <= 0 || buf.length <= snapshotSize) return false;
    const appended = buf.subarray(snapshotSize).toString("utf-8");
    if (!appended.trim()) return false;

    const lines = appended.split("\n").filter((line) => line.trim().length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as unknown;
        if (lineContainsToolResult(parsed) || lineContainsUserMessage(parsed)) {
          return true;
        }
      } catch {
        // Ignore malformed lines in tail append section.
      }
    }
  } catch {
    // If we cannot inspect the transcript, keep blocked until TTL/session end.
    return false;
  }
  return false;
}

function lineContainsUserMessage(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;

  if (obj.role === "user") return true;
  if (obj.message && typeof obj.message === "object") {
    const msg = obj.message as Record<string, unknown>;
    if (msg.role === "user") return true;
  }

  return false;
}

function lineContainsToolResult(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;

  const message = obj.message && typeof obj.message === "object"
    ? (obj.message as Record<string, unknown>)
    : obj;
  const content = message.content;
  if (!Array.isArray(content)) return false;

  return content.some((block) => (
    !!block
    && typeof block === "object"
    && (block as Record<string, unknown>).type === "tool_result"
  ));
}

// ─── Describe blocked tool for UI ────────────────────────────────────────────

export function describeBlockedTool(info: BlockedInfo): string {
  const { toolName, toolInput } = info;

  switch (toolName) {
    case "Bash": {
      const desc = toolInput.description;
      if (typeof desc === "string" && desc.length > 0) return desc;
      return "Run a command";
    }
    case "Edit": {
      const filePath = toolInput.file_path;
      if (typeof filePath === "string") return `Edit ${basename(filePath)}`;
      return "Edit a file";
    }
    case "Write": {
      const filePath = toolInput.file_path;
      if (typeof filePath === "string") return `Write ${basename(filePath)}`;
      return "Write a file";
    }
    case "WebFetch": {
      const url = toolInput.url;
      if (typeof url === "string") {
        try { return `Fetch ${new URL(url).hostname}`; } catch { /* fall through */ }
      }
      return "Fetch a URL";
    }
    case "WebSearch":
      return "Web search";
    case "AskUserQuestion":
      return "Answering a question";
    case "ExitPlanMode":
      return "Plan approval";
    default:
      return `Approve ${toolName}`;
  }
}

// ─── Auto-install Claude Code hooks ─────────────────────────────────────────

const CLAUDE_DIR = join(homedir(), ".claude");
const SETTINGS_PATH = join(CLAUDE_DIR, "settings.json");

const HOOK_MARKER = "localhost:7433/api/hooks/blocked";

const HEXDECK_HOOK = {
  matcher: ".*",
  hooks: [
    {
      type: "command",
      command: `curl -s -X POST http://localhost:7433/api/hooks/blocked -H 'Content-Type: application/json' -d @- &>/dev/null`,
      timeout: 5,
    },
  ],
};

/** PreToolUse hook — tools that block on user interaction */
const INTERACTIVE_TOOL_HOOK = {
  matcher: "AskUserQuestion|ExitPlanMode",
  hooks: [
    {
      type: "command",
      command: `curl -s -X POST http://localhost:7433/api/hooks/blocked -H 'Content-Type: application/json' -d @- &>/dev/null`,
      timeout: 5,
    },
  ],
};

/** Hook event types that mean "agent is waiting for user action" */
const HOOK_EVENTS = ["PermissionRequest", "Stop"] as const;

/**
 * Ensure hexdeck hooks are installed in ~/.claude/settings.json.
 * Hooks into PermissionRequest (tool approvals) and Stop (plan approval, idle prompt).
 * Preserves all existing user hooks. Only runs once at server startup.
 */
export function ensureHooks(): void {
  try {
    // Ensure directory exists
    if (!existsSync(CLAUDE_DIR)) {
      mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    // Read or initialize settings
    let settings: Record<string, unknown> = {};
    if (existsSync(SETTINGS_PATH)) {
      try {
        settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
      } catch {
        // Corrupt file — start with empty object, preserve file by writing back
        settings = {};
      }
    }

    if (!settings.hooks || typeof settings.hooks !== "object") {
      settings.hooks = {};
    }
    const hooks = settings.hooks as Record<string, unknown>;

    let dirty = false;

    for (const eventType of HOOK_EVENTS) {
      if (!Array.isArray(hooks[eventType])) {
        hooks[eventType] = [];
      }
      const eventHooks = hooks[eventType] as unknown[];

      // Check if hexdeck hook already exists for this event
      const alreadyInstalled = eventHooks.some((entry: unknown) => {
        if (!entry || typeof entry !== "object") return false;
        const e = entry as Record<string, unknown>;
        if (!Array.isArray(e.hooks)) return false;
        return (e.hooks as unknown[]).some((h: unknown) => {
          if (!h || typeof h !== "object") return false;
          const hk = h as Record<string, unknown>;
          return typeof hk.command === "string" && hk.command.includes(HOOK_MARKER);
        });
      });

      if (!alreadyInstalled) {
        eventHooks.push(HEXDECK_HOOK);
        dirty = true;
      }
    }

    // PreToolUse hook for interactive tools.
    // Upgrade older installs that only matched AskUserQuestion so ExitPlanMode
    // prompts are captured too.
    if (!Array.isArray(hooks["PreToolUse"])) {
      hooks["PreToolUse"] = [];
    }
    const preToolHooks = hooks["PreToolUse"] as unknown[];
    let interactiveHookInstalled = false;
    for (const entry of preToolHooks) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (!Array.isArray(e.hooks)) continue;
      const hasHexdeckCommand = (e.hooks as unknown[]).some((h: unknown) => {
        if (!h || typeof h !== "object") return false;
        const hk = h as Record<string, unknown>;
        return typeof hk.command === "string" && hk.command.includes(HOOK_MARKER);
      });
      if (!hasHexdeckCommand) continue;

      interactiveHookInstalled = true;
      const matcher = typeof e.matcher === "string" ? e.matcher : "";
      const coversAsk = matcher.includes("AskUserQuestion");
      const coversExitPlan = matcher.includes("ExitPlanMode");
      if (!coversAsk || !coversExitPlan) {
        e.matcher = INTERACTIVE_TOOL_HOOK.matcher;
        dirty = true;
      }
      break;
    }
    if (!interactiveHookInstalled) {
      preToolHooks.push(INTERACTIVE_TOOL_HOOK);
      dirty = true;
    }

    if (!dirty) return;

    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log("Hexdeck: installed hooks in ~/.claude/settings.json");
  } catch (err) {
    console.error("Hexdeck: failed to install hooks:", err);
  }
}
