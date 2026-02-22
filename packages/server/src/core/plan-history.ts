import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { listProjects, listSessions } from "../discovery/sessions.js";
import { discoverCodexSessions, getActiveCodexSessions } from "../discovery/codex.js";
import { parseSessionFile, parseSystemLines } from "../parser/jsonl.js";
import { parseCodexSessionFile } from "../parser/codex.js";
import { buildParsedSession } from "./nodes.js";
import { buildCodexParsedSession } from "./codex-nodes.js";
import type {
  AgentType, ParsedSession, PlanStatus, PlanTask, SessionInfo,
  PlanHistoryCursor, PlanHistoryDetailItem, PlanHistoryItem, PlanHistoryPage,
  PlanHistoryQuery, PlanHistoryRefreshResult, PlanTaskCounts, SessionPlanHistory,
} from "../types/index.js";

const PYLON_DIR = join(homedir(), ".pylon");
const PLAN_HISTORY_PATH = join(PYLON_DIR, "plan-history.json");
const PLAN_HISTORY_VERSION = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_PARSE_BUDGET = 20;
const RESCAN_INTERVAL_MS = 15_000;
const CODEX_HISTORY_WINDOW_DAYS = 3650;

interface TrackedSession {
  info: SessionInfo;
  agentType: AgentType;
}

interface SessionHistoryEntry {
  key: string;
  sessionId: string;
  path: string;
  projectPath: string;
  agentType: AgentType;
  mtimeMs: number;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
  plans: PersistedPlan[];
}

interface PersistedPlan extends Omit<PlanHistoryDetailItem, "timestamp"> {
  timestamp: string;
}

interface PersistedState {
  version: number;
  updatedAt: string;
  sessions: SessionHistoryEntry[];
}

interface SessionPlanCycle {
  status: PlanStatus;
  markdown: string | null;
  tasks: PlanTask[];
  timestamp: Date;
  durationMs: number | null;
}

function sessionKey(session: SessionInfo): string {
  return `${session.path}::${session.id}`;
}

function isCodexSession(session: SessionInfo): boolean {
  return session.path.includes("/.codex/");
}

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function encodeCursor(cursor: PlanHistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64url");
}

function decodeCursor(raw?: string): PlanHistoryCursor | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")) as Partial<PlanHistoryCursor>;
    if (typeof decoded.timestampMs !== "number" || typeof decoded.planId !== "string") return null;
    return { timestampMs: decoded.timestampMs, planId: decoded.planId };
  } catch {
    return null;
  }
}

function planSortDesc(a: PlanHistoryItem, b: PlanHistoryItem): number {
  const byTime = b.timestamp.getTime() - a.timestamp.getTime();
  if (byTime !== 0) return byTime;
  return b.planId.localeCompare(a.planId);
}

function buildTaskCounts(tasks: PlanTask[]): PlanTaskCounts {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  for (const task of tasks) {
    if (task.status === "deleted") continue;
    if (task.status === "completed") completed++;
    else if (task.status === "in_progress") inProgress++;
    else pending++;
  }

  return {
    total: completed + inProgress + pending,
    completed,
    inProgress,
    pending,
  };
}

function extractPlanTitle(markdown: string | null, tasks: PlanTask[]): string {
  if (markdown) {
    const heading = markdown.match(/^#\s+(.+)$/m);
    if (heading?.[1]?.trim()) return heading[1].trim().slice(0, 120);
    const firstLine = markdown.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
    if (firstLine) return firstLine.slice(0, 120);
  }
  const taskSubject = tasks.find((t) => t.status !== "deleted")?.subject.trim();
  if (taskSubject) return taskSubject.slice(0, 120);
  return "Implementation plan";
}

function toPersisted(item: PlanHistoryDetailItem): PersistedPlan {
  return {
    ...item,
    timestamp: item.timestamp.toISOString(),
  };
}

function fromPersisted(item: PersistedPlan): PlanHistoryDetailItem {
  return {
    ...item,
    timestamp: new Date(item.timestamp),
  };
}

function finalizePlanCycle(
  tasks: PlanTask[],
  taskStatuses: Map<string, string>,
  markdown: string | null,
  inPlanMode: boolean,
  planAccepted: boolean,
  planRejected: boolean,
  timestamp: Date,
  durationMs: number | null,
): SessionPlanCycle | null {
  for (const task of tasks) {
    const latest = taskStatuses.get(task.id);
    if (latest === "completed" || latest === "in_progress" || latest === "pending" || latest === "deleted") {
      task.status = latest;
    }
  }

  const activeTasks = tasks.filter((t) => t.status !== "deleted");
  let status: PlanStatus = "none";

  if (activeTasks.length > 0) {
    if (activeTasks.every((t) => t.status === "completed")) status = "completed";
    else if (activeTasks.some((t) => t.status === "in_progress" || t.status === "completed")) status = "implementing";
    else status = "drafting";
  } else if (markdown || inPlanMode || planAccepted || planRejected) {
    if (planRejected) status = "rejected";
    else if (inPlanMode || planAccepted || markdown) status = "drafting";
  }

  if (status === "none") return null;
  return { status, markdown, tasks: activeTasks, timestamp, durationMs };
}

function extractPlanCycles(parsed: ParsedSession): SessionPlanCycle[] {
  const finalized: SessionPlanCycle[] = [];

  let markdown: string | null = null;
  let planAccepted = false;
  let planRejected = false;
  let inPlanMode = false;
  let lastPlanTs: Date = parsed.session.createdAt;
  let planStartTs: Date | null = null;
  let planDurationMs: number | null = null;
  let tasks: PlanTask[] = [];
  let taskStatuses = new Map<string, string>();

  for (const turn of parsed.turns) {
    if (turn.hasPlanStart) {
      const prior = finalizePlanCycle(
        tasks, taskStatuses, markdown, inPlanMode, planAccepted, planRejected, lastPlanTs, planDurationMs,
      );
      if (prior) finalized.push(prior);

      tasks = [];
      taskStatuses = new Map();
      markdown = null;
      inPlanMode = true;
      planAccepted = false;
      planRejected = false;
      lastPlanTs = turn.timestamp;
      planStartTs = turn.timestamp;
      planDurationMs = null;
    }

    if (turn.hasPlanEnd && !turn.planRejected) {
      inPlanMode = false;
      planAccepted = true;
      planRejected = false;
      markdown = turn.planMarkdown ?? markdown;
      lastPlanTs = turn.timestamp;
      if (planStartTs) {
        planDurationMs = turn.timestamp.getTime() - planStartTs.getTime();
      }
    }

    if (turn.hasPlanEnd && turn.planRejected) {
      inPlanMode = false;
      planAccepted = false;
      planRejected = true;
      lastPlanTs = turn.timestamp;
      planDurationMs = null;
    }

    if (turn.planMarkdown && !markdown) {
      markdown = turn.planMarkdown;
      lastPlanTs = turn.timestamp;
    }

    for (const tc of turn.taskCreates) {
      if (tc.taskId) {
        tasks.push({
          id: tc.taskId,
          subject: tc.subject,
          description: tc.description,
          status: "pending",
        });
        lastPlanTs = turn.timestamp;
      }
    }

    for (const tu of turn.taskUpdates) {
      taskStatuses.set(tu.taskId, tu.status);
      lastPlanTs = turn.timestamp;
    }
  }

  const tail = finalizePlanCycle(
    tasks, taskStatuses, markdown, inPlanMode, planAccepted, planRejected, lastPlanTs, planDurationMs,
  );
  if (tail) finalized.push(tail);

  return finalized;
}

function cyclesToDetailItems(parsed: ParsedSession, agentType: AgentType): PlanHistoryDetailItem[] {
  const cycles = extractPlanCycles(parsed);
  const out: PlanHistoryDetailItem[] = [];

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    out.push({
      planId: `${parsed.session.id}:${cycle.timestamp.getTime()}:${i}`,
      sessionId: parsed.session.id,
      projectPath: parsed.session.projectPath,
      agentType,
      status: cycle.status,
      timestamp: cycle.timestamp,
      title: extractPlanTitle(cycle.markdown, cycle.tasks),
      taskCounts: buildTaskCounts(cycle.tasks),
      durationMs: cycle.durationMs,
      markdown: cycle.markdown,
      tasks: cycle.tasks,
    });
  }

  return out;
}

function toListItem(item: PlanHistoryDetailItem): PlanHistoryItem {
  return {
    planId: item.planId,
    sessionId: item.sessionId,
    projectPath: item.projectPath,
    agentType: item.agentType,
    status: item.status,
    timestamp: item.timestamp,
    title: item.title,
    taskCounts: item.taskCounts,
    durationMs: item.durationMs,
  };
}

function parseDateBoundary(raw?: string): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

export class PlanHistoryIndex {
  private loaded = false;
  private updatedAt = new Date(0);
  private sessions = new Map<string, SessionHistoryEntry>();
  private dirtySessions = new Map<string, TrackedSession>();
  private lastRescanAt = 0;

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;

    if (!existsSync(PLAN_HISTORY_PATH)) return;

    try {
      const raw = JSON.parse(readFileSync(PLAN_HISTORY_PATH, "utf-8")) as PersistedState;
      if (!raw || raw.version !== PLAN_HISTORY_VERSION || !Array.isArray(raw.sessions)) return;

      this.updatedAt = new Date(raw.updatedAt);
      for (const entry of raw.sessions) {
        if (!entry?.key || !entry?.sessionId || !Array.isArray(entry.plans)) continue;
        this.sessions.set(entry.key, entry);
      }
    } catch {
      this.sessions.clear();
      this.updatedAt = new Date(0);
    }
  }

  private persist(): void {
    try {
      if (!existsSync(PYLON_DIR)) mkdirSync(PYLON_DIR, { recursive: true });

      const payload: PersistedState = {
        version: PLAN_HISTORY_VERSION,
        updatedAt: this.updatedAt.toISOString(),
        sessions: [...this.sessions.values()],
      };
      writeFileSync(PLAN_HISTORY_PATH, JSON.stringify(payload, null, 2), "utf-8");
    } catch {
      // Persist failure is non-fatal; in-memory state remains valid.
    }
  }

  private discoverAllSessions(): TrackedSession[] {
    const out = new Map<string, TrackedSession>();

    for (const project of listProjects()) {
      const sessions = listSessions(project.encodedName);
      for (const session of sessions) {
        out.set(sessionKey(session), {
          info: session,
          agentType: isCodexSession(session) ? "codex" : "claude",
        });
      }
    }

    try {
      const codex = [
        ...discoverCodexSessions(CODEX_HISTORY_WINDOW_DAYS),
        ...getActiveCodexSessions(),
      ];
      for (const session of codex) {
        out.set(sessionKey(session), { info: session, agentType: "codex" });
      }
    } catch {
      // Codex discovery is best-effort.
    }

    return [...out.values()].sort(
      (a, b) => b.info.modifiedAt.getTime() - a.info.modifiedAt.getTime()
    );
  }

  private reindexSessions(force: boolean): { scanned: boolean; droppedSessions: number } {
    const now = Date.now();
    const hasPending = this.dirtySessions.size > 0;
    if (!force && hasPending) return { scanned: false, droppedSessions: 0 };
    if (!force && now - this.lastRescanAt < RESCAN_INTERVAL_MS) return { scanned: false, droppedSessions: 0 };

    const discovered = this.discoverAllSessions();
    this.lastRescanAt = now;

    const discoveredKeys = new Set(discovered.map((s) => sessionKey(s.info)));
    let droppedSessions = 0;
    for (const key of this.sessions.keys()) {
      if (!discoveredKeys.has(key)) {
        this.sessions.delete(key);
        this.dirtySessions.delete(key);
        droppedSessions++;
      }
    }

    for (const tracked of discovered) {
      const key = sessionKey(tracked.info);
      const cached = this.sessions.get(key);
      if (!cached) {
        this.dirtySessions.set(key, tracked);
        continue;
      }
      const changed = cached.mtimeMs !== tracked.info.modifiedAt.getTime()
        || cached.sizeBytes !== tracked.info.sizeBytes
        || cached.path !== tracked.info.path;
      if (changed) {
        this.dirtySessions.set(key, tracked);
      }
    }

    return { scanned: true, droppedSessions };
  }

  private parseTrackedSession(tracked: TrackedSession): PlanHistoryDetailItem[] | null {
    try {
      if (tracked.agentType === "codex") {
        const events = parseCodexSessionFile(tracked.info.path);
        const parsed = buildCodexParsedSession(tracked.info, events);
        return cyclesToDetailItems(parsed, "codex");
      }

      const events = parseSessionFile(tracked.info.path);
      const systemMeta = parseSystemLines(tracked.info.path);
      const parsed = buildParsedSession(tracked.info, events, systemMeta);
      return cyclesToDetailItems(parsed, "claude");
    } catch {
      return null;
    }
  }

  refresh(options?: { force?: boolean; parseBudget?: number }): PlanHistoryRefreshResult {
    this.ensureLoaded();

    const force = options?.force ?? false;
    const parseBudget = Math.max(1, Math.floor(options?.parseBudget ?? DEFAULT_PARSE_BUDGET));
    const reindex = this.reindexSessions(force);

    let parsedSessions = 0;
    const dirtyList = [...this.dirtySessions.entries()]
      .sort((a, b) => b[1].info.modifiedAt.getTime() - a[1].info.modifiedAt.getTime())
      .slice(0, parseBudget);

    for (const [key, tracked] of dirtyList) {
      const plans = this.parseTrackedSession(tracked);
      if (!plans) {
        this.dirtySessions.delete(key);
        continue;
      }

      const entry: SessionHistoryEntry = {
        key,
        sessionId: tracked.info.id,
        path: tracked.info.path,
        projectPath: tracked.info.projectPath,
        agentType: tracked.agentType,
        mtimeMs: tracked.info.modifiedAt.getTime(),
        sizeBytes: tracked.info.sizeBytes,
        createdAt: tracked.info.createdAt.toISOString(),
        modifiedAt: tracked.info.modifiedAt.toISOString(),
        plans: plans.map(toPersisted),
      };
      this.sessions.set(key, entry);
      this.dirtySessions.delete(key);
      parsedSessions++;
    }

    if (reindex.scanned || parsedSessions > 0 || reindex.droppedSessions > 0) {
      this.updatedAt = new Date();
      this.persist();
    }

    return {
      scanned: reindex.scanned,
      parsedSessions,
      droppedSessions: reindex.droppedSessions,
      remainingDirtySessions: this.dirtySessions.size,
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  list(query: PlanHistoryQuery = {}): PlanHistoryPage {
    this.ensureLoaded();

    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const fromMs = parseDateBoundary(query.from);
    const toMs = parseDateBoundary(query.to);

    let items: PlanHistoryItem[] = [];
    for (const entry of this.sessions.values()) {
      for (const persisted of entry.plans) {
        const detail = fromPersisted(persisted);
        items.push(toListItem(detail));
      }
    }

    items = items.filter((item) => {
      if (query.projectPath && item.projectPath !== query.projectPath) return false;
      if (query.sessionId && item.sessionId !== query.sessionId) return false;
      if (query.status && item.status !== query.status) return false;
      const ts = item.timestamp.getTime();
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      return true;
    });

    items.sort(planSortDesc);

    if (cursor) {
      items = items.filter((item) => {
        const ts = item.timestamp.getTime();
        if (ts < cursor.timestampMs) return true;
        if (ts > cursor.timestampMs) return false;
        return item.planId < cursor.planId;
      });
    }

    const pageItems = items.slice(0, limit);
    const hasMore = items.length > pageItems.length;
    const last = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({ timestampMs: last.timestamp.getTime(), planId: last.planId })
      : null;

    return { items: pageItems, nextCursor, hasMore };
  }

  listSession(sessionId: string): SessionPlanHistory | null {
    this.ensureLoaded();

    const entries = [...this.sessions.values()].filter((e) => e.sessionId === sessionId);
    if (entries.length === 0) return null;

    entries.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
    const latest = entries[0];
    const plans = latest.plans.map(fromPersisted).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      sessionId: latest.sessionId,
      projectPath: latest.projectPath,
      agentType: latest.agentType,
      plans,
    };
  }

  getMeta(): { updatedAt: string; sessionCount: number; dirtySessionCount: number } {
    this.ensureLoaded();
    return {
      updatedAt: this.updatedAt.toISOString(),
      sessionCount: this.sessions.size,
      dirtySessionCount: this.dirtySessions.size,
    };
  }
}

export const planHistoryIndex = new PlanHistoryIndex();
