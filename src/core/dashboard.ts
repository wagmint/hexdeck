import { statSync } from "fs";
import { basename } from "path";
import { getActiveSessions, listProjects, listSessions } from "../discovery/sessions.js";
import { parseSessionFile, parseSystemLines } from "../parser/jsonl.js";
import { buildParsedSession } from "./nodes.js";
import { detectCollisions } from "./collisions.js";
import { buildFeed } from "./feed.js";
import { computeAgentRisk, computeWorkstreamRisk } from "./risk.js";
import type {
  ParsedSession, SessionInfo, Agent, AgentStatus,
  Workstream, DashboardState, DashboardSummary,
  SessionPlan, PlanStatus, PlanTask, TokenUsage,
} from "../types/index.js";

// ─── In-memory parse cache ──────────────────────────────────────────────────

interface CacheEntry {
  mtimeMs: number;
  parsed: ParsedSession;
}

const parseCache = new Map<string, CacheEntry>();

// ─── Session accumulator — survives compaction ──────────────────────────────

interface SessionAccumulator {
  totalTurns: number;
  totalToolCalls: number;
  totalCommits: number;
  totalCompactions: number;
  totalErrorTurns: number;
  totalCorrectionTurns: number;
  totalTokenUsage: TokenUsage;
  filesChanged: Set<string>;
  toolsUsed: Record<string, number>;
  primaryModel: string | null;
  plan: SessionPlan | null;
  errorHistory: boolean[];
}

const accumulators = new Map<string, SessionAccumulator>();

// ─── Accumulator helpers ─────────────────────────────────────────────────────

function maxTokenUsage(a: TokenUsage | undefined, b: TokenUsage): TokenUsage {
  if (!a) return { ...b };
  return {
    inputTokens: Math.max(a.inputTokens, b.inputTokens),
    outputTokens: Math.max(a.outputTokens, b.outputTokens),
    cacheReadInputTokens: Math.max(a.cacheReadInputTokens, b.cacheReadInputTokens),
    cacheCreationInputTokens: Math.max(a.cacheCreationInputTokens, b.cacheCreationInputTokens),
  };
}

function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
  };
}

function unionSets(a: Set<string> | undefined, b: Set<string>): Set<string> {
  if (!a) return new Set(b);
  return new Set([...a, ...b]);
}

function mergeToolsUsed(
  a: Record<string, number> | undefined,
  b: Record<string, number>
): Record<string, number> {
  if (!a) return { ...b };
  const merged = { ...a };
  for (const [tool, count] of Object.entries(b)) {
    merged[tool] = Math.max(merged[tool] ?? 0, count);
  }
  return merged;
}

const AGENT_NAMES = [
  "neo", "morpheus", "trinity", "oracle", "cypher", "tank", "dozer", "switch",
  "apoc", "mouse", "niobe", "link", "ghost", "zee", "lock", "merovingian",
  "seraph", "sati", "rama", "ajax", "jue", "thadeus", "ballard", "mifune",
  "hamann", "deus", "trainman", "persephone", "keymaker", "architect",
];

function hashToIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Assign unique short names per dashboard cycle. Same ID → same name. */
function buildLabelMap(sessionIds: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const usedNames = new Set<string>();

  // Sort by hash for deterministic assignment
  const sorted = [...sessionIds].sort((a, b) => hashToIndex(a) - hashToIndex(b));

  for (const id of sorted) {
    let idx = hashToIndex(id) % AGENT_NAMES.length;
    let name = AGENT_NAMES[idx];

    // Resolve collisions
    let attempt = 0;
    while (usedNames.has(name)) {
      attempt++;
      idx = (idx + 1) % AGENT_NAMES.length;
      if (attempt >= AGENT_NAMES.length) {
        name = AGENT_NAMES[hashToIndex(id) % AGENT_NAMES.length] + `-${attempt}`;
        break;
      }
      name = AGENT_NAMES[idx];
    }

    usedNames.add(name);
    map.set(id, name);
  }

  return map;
}

function updateAccumulator(sessionId: string, parsed: ParsedSession): void {
  const prev = accumulators.get(sessionId);
  const { stats } = parsed;

  const acc: SessionAccumulator = {
    totalTurns: Math.max(prev?.totalTurns ?? 0, stats.totalTurns),
    totalToolCalls: Math.max(prev?.totalToolCalls ?? 0, stats.toolCalls),
    totalCommits: Math.max(prev?.totalCommits ?? 0, stats.commits),
    totalCompactions: Math.max(prev?.totalCompactions ?? 0, stats.compactions),
    totalErrorTurns: Math.max(prev?.totalErrorTurns ?? 0, stats.errorTurns),
    totalCorrectionTurns: Math.max(prev?.totalCorrectionTurns ?? 0, stats.correctionTurns),
    totalTokenUsage: maxTokenUsage(prev?.totalTokenUsage, stats.totalTokenUsage),
    filesChanged: unionSets(prev?.filesChanged, new Set(stats.filesChanged)),
    toolsUsed: mergeToolsUsed(prev?.toolsUsed, stats.toolsUsed),
    primaryModel: stats.primaryModel ?? prev?.primaryModel ?? null,
    plan: null,
    errorHistory: [],
  };

  // Plan: keep the most advanced plan state
  const currentPlan = buildSessionPlan(parsed);
  if (currentPlan.status !== "none") {
    acc.plan = currentPlan;
  } else {
    acc.plan = prev?.plan ?? null;
  }

  // Error history: extend on compaction, replace on normal growth
  const prevHistory = prev?.errorHistory ?? [];
  const currentErrors = parsed.turns.map(t => t.hasError);
  if (prev && prev.totalTurns > parsed.turns.length) {
    // Compaction: keep old history, append new post-compaction turns
    acc.errorHistory = [...prevHistory, ...currentErrors];
  } else {
    // Normal: current parse is the full history
    acc.errorHistory = currentErrors;
  }

  accumulators.set(sessionId, acc);
}

function mergeAccumulatorIntoStats(acc: SessionAccumulator, parsed: ParsedSession): void {
  // Compaction: accumulated baseline + post-compaction delta (current parse)
  parsed.stats.totalTurns = acc.totalTurns + parsed.stats.totalTurns;
  parsed.stats.toolCalls = acc.totalToolCalls + parsed.stats.toolCalls;
  parsed.stats.commits = acc.totalCommits + parsed.stats.commits;
  parsed.stats.compactions = acc.totalCompactions; // already counted
  parsed.stats.errorTurns = acc.totalErrorTurns + parsed.stats.errorTurns;
  parsed.stats.correctionTurns = acc.totalCorrectionTurns + parsed.stats.correctionTurns;
  parsed.stats.totalTokenUsage = addTokenUsage(acc.totalTokenUsage, parsed.stats.totalTokenUsage);
  parsed.stats.filesChanged = [...new Set([...acc.filesChanged, ...parsed.stats.filesChanged])];
  parsed.stats.toolsUsed = mergeToolsUsed(acc.toolsUsed, parsed.stats.toolsUsed);
  parsed.stats.primaryModel = parsed.stats.primaryModel ?? acc.primaryModel;
}

function getCachedOrParse(session: SessionInfo): ParsedSession {
  const cached = parseCache.get(session.id);
  let currentMtime: number;

  try {
    currentMtime = statSync(session.path).mtimeMs;
  } catch {
    // File may have been deleted; parse fresh
    currentMtime = 0;
  }

  if (cached && cached.mtimeMs === currentMtime) {
    return cached.parsed;
  }

  const events = parseSessionFile(session.path);
  const systemMeta = parseSystemLines(session.path);
  const parsed = buildParsedSession(session, events, systemMeta);

  // Compaction detection: accumulator had more turns than current parse
  const acc = accumulators.get(session.id);
  const isCompaction = acc && acc.totalTurns > parsed.turns.length;

  if (isCompaction) {
    mergeAccumulatorIntoStats(acc, parsed);
  }

  // Always update accumulator to reflect current state
  updateAccumulator(session.id, parsed);

  parseCache.set(session.id, { mtimeMs: currentMtime, parsed });
  return parsed;
}

// ─── Plan builder ────────────────────────────────────────────────────────────

function buildSessionPlan(parsed: ParsedSession): SessionPlan {
  let status: PlanStatus = "none";
  let markdown: string | null = null;
  const tasks: PlanTask[] = [];
  const taskStatuses = new Map<string, string>();

  for (const turn of parsed.turns) {
    if (turn.hasPlanStart) status = "drafting";
    if (turn.hasPlanEnd && !turn.planRejected) {
      status = "approved";
      markdown = turn.planMarkdown;
    }
    if (turn.hasPlanEnd && turn.planRejected) {
      status = "drafting";
    }

    // Cross-session plan: planMarkdown from JSONL envelope (user approved plan in this session)
    if (turn.planMarkdown && !markdown) {
      markdown = turn.planMarkdown;
      if (status === "none") status = "implementing";
    }

    for (const tc of turn.taskCreates) {
      if (tc.taskId) {
        tasks.push({
          id: tc.taskId,
          subject: tc.subject,
          description: tc.description,
          status: "pending",
        });
      }
    }

    for (const tu of turn.taskUpdates) {
      taskStatuses.set(tu.taskId, tu.status);
    }
  }

  // Apply final statuses
  for (const task of tasks) {
    const latest = taskStatuses.get(task.id);
    if (latest === "completed" || latest === "in_progress" || latest === "pending" || latest === "deleted") {
      task.status = latest;
    }
  }

  // If plan is approved/drafting and tasks are being worked on, it's implementing
  // "drafting" can have tasks when ExitPlanMode wasn't called (user approved via prompt)
  if ((status === "approved" || status === "drafting") && tasks.some(t => t.status === "in_progress" || t.status === "completed")) {
    status = "implementing";
  }

  // If all tasks are completed, plan is done
  const activeTasks = tasks.filter(t => t.status !== "deleted");
  if (status === "implementing" && activeTasks.length > 0 && activeTasks.every(t => t.status === "completed")) {
    status = "completed";
  }

  return { status, markdown, tasks: activeTasks };
}

// ─── Dashboard builder ──────────────────────────────────────────────────────

/** Grace period: keep recently-dead sessions visible so plans survive session transitions */
const RECENT_GRACE_MS = 5 * 60 * 1000; // 5 minutes

export function buildDashboardState(): DashboardState {
  // 1. Get all active sessions
  const activeSessions = getActiveSessions();
  const activeSessionIds = new Set(activeSessions.map(s => s.id));

  // 2. Include active sessions + recently-dead sessions from same projects
  //    This bridges the gap when "execute and clear context" kills one session
  //    and starts another — the old session's plan stays visible briefly.
  const allSessions = new Map<string, SessionInfo>();
  for (const s of activeSessions) {
    allSessions.set(s.id, s);
  }

  const projects = listProjects();
  const now = Date.now();

  // For each project with active sessions, include recent inactive sessions
  const activeProjectPaths = new Set(activeSessions.map(s => s.projectPath));
  for (const project of projects) {
    if (!activeProjectPaths.has(project.decodedPath)) continue;
    const projectSessions = listSessions(project.encodedName);
    for (const s of projectSessions) {
      if (allSessions.has(s.id)) continue; // already active
      // Include if modified within grace period
      if (now - s.modifiedAt.getTime() < RECENT_GRACE_MS) {
        allSessions.set(s.id, s);
      }
    }
  }

  // 3. Parse all sessions
  const parsedSessions: ParsedSession[] = [];
  for (const session of allSessions.values()) {
    try {
      parsedSessions.push(getCachedOrParse(session));
    } catch {
      // Skip unparseable sessions
    }
  }

  // 4. Build session label map
  const labelMap = buildLabelMap(parsedSessions.map(p => p.session.id));

  // 5. Detect collisions (only between currently active sessions)
  const activeParsed = parsedSessions.filter(p => activeSessionIds.has(p.session.id));
  const collisions = detectCollisions(activeParsed, labelMap);
  const collisionFileSet = new Set(collisions.flatMap(c => c.agents.map(a => a.sessionId)));

  // 6. Build agents
  const agents: Agent[] = [];

  for (const parsed of parsedSessions) {
    const projectPath = parsed.session.projectPath;
    const label = labelMap.get(parsed.session.id) ?? parsed.session.id.slice(0, 8);
    const isActive = activeSessionIds.has(parsed.session.id);
    const status = determineAgentStatus(parsed, isActive, collisionFileSet);

    const lastTurn = parsed.turns[parsed.turns.length - 1];
    const currentTask = lastTurn?.summary ?? "idle";

    // Plan: fall back to accumulator if current parse lost it (compaction)
    const sessionAcc = accumulators.get(parsed.session.id);
    let plan = buildSessionPlan(parsed);
    if (plan.status === "none" && sessionAcc?.plan) {
      plan = sessionAcc.plan;
    }

    // Risk: pass accumulated error history for trend continuity
    const risk = computeAgentRisk(parsed, sessionAcc?.errorHistory);

    agents.push({
      sessionId: parsed.session.id,
      label,
      status,
      currentTask,
      filesChanged: parsed.stats.filesChanged,
      projectPath,
      isActive,
      plan,
      risk,
    });
  }

  // 6. Build workstreams (group by project)
  const projectGroups = new Map<string, ParsedSession[]>();
  for (const parsed of parsedSessions) {
    const key = parsed.session.projectPath;
    if (!projectGroups.has(key)) projectGroups.set(key, []);
    projectGroups.get(key)!.push(parsed);
  }

  const workstreams: Workstream[] = [];
  for (const [projectPath, sessions] of projectGroups) {
    const projectAgents = agents.filter(a => a.projectPath === projectPath);
    let totalTurns = 0;
    let completedTurns = 0;
    let commits = 0;
    let errors = 0;

    for (const s of sessions) {
      totalTurns += s.turns.length;
      completedTurns += s.turns.filter(t => t.hasCommit).length;
      commits += s.stats.commits;
      errors += s.turns.filter(t => t.hasError).length;
    }

    const hasCollision = projectAgents.some(a => a.status === "conflict");

    // Aggregate plans and tasks — skip empty drafts (session died before plan was written)
    const plans = projectAgents.map(a => a.plan).filter(p =>
      p.status !== "none" && !(p.status === "drafting" && !p.markdown)
    );
    const planTasks = plans.flatMap(p => p.tasks);

    // Progress: use task completion if tasks exist, otherwise fall back to commit ratio
    let completionPct: number;
    if (planTasks.length > 0) {
      const done = planTasks.filter(t => t.status === "completed").length;
      completionPct = Math.round((done / planTasks.length) * 100);
    } else {
      completionPct = totalTurns > 0 ? Math.round((completedTurns / totalTurns) * 100) : 0;
    }

    // Find the encoded project name for this path
    const project = projects.find(p => p.decodedPath === projectPath);
    const projectId = project?.encodedName ?? projectPath.replace(/\//g, "-");

    const risk = computeWorkstreamRisk(projectAgents);

    workstreams.push({
      projectId,
      projectPath,
      name: basename(projectPath) || projectPath,
      agents: projectAgents,
      completionPct,
      totalTurns,
      completedTurns,
      hasCollision,
      commits,
      errors,
      plans,
      planTasks,
      risk,
    });
  }

  // Sort workstreams: active first, then by name
  workstreams.sort((a, b) => {
    const aActive = a.agents.some(ag => ag.isActive);
    const bActive = b.agents.some(ag => ag.isActive);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // 8. Build feed
  const feed = buildFeed(parsedSessions, collisions, labelMap);

  // 8. Build summary
  const agentsAtRisk = agents.filter(a => a.risk.overallRisk !== "nominal").length;
  const summary: DashboardSummary = {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.isActive).length,
    totalCollisions: collisions.length,
    criticalCollisions: collisions.filter(c => c.severity === "critical").length,
    totalWorkstreams: workstreams.length,
    totalCommits: workstreams.reduce((sum, w) => sum + w.commits, 0),
    totalErrors: workstreams.reduce((sum, w) => sum + w.errors, 0),
    agentsAtRisk,
  };

  return { agents, workstreams, collisions, feed, summary };
}

function determineAgentStatus(
  parsed: ParsedSession,
  isActive: boolean,
  collisionSessionIds: Set<string>
): AgentStatus {
  // Conflict: this session has files in a detected collision
  if (collisionSessionIds.has(parsed.session.id)) return "conflict";

  // Warning: errors in the last 3 turns
  const recentTurns = parsed.turns.slice(-3);
  if (recentTurns.some(t => t.hasError)) return "warning";

  // Busy: currently active process
  if (isActive) return "busy";

  return "idle";
}
