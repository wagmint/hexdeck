import { statSync } from "fs";
import { basename } from "path";
import { getActiveSessions, listProjects, listSessions } from "../discovery/sessions.js";
import { parseSessionFile } from "../parser/jsonl.js";
import { buildParsedSession } from "./nodes.js";
import { detectCollisions } from "./collisions.js";
import { buildFeed } from "./feed.js";
import type {
  ParsedSession, SessionInfo, Agent, AgentStatus,
  Workstream, DashboardState, DashboardSummary,
} from "../types/index.js";

// ─── In-memory parse cache ──────────────────────────────────────────────────

interface CacheEntry {
  mtimeMs: number;
  parsed: ParsedSession;
}

const parseCache = new Map<string, CacheEntry>();

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
  const parsed = buildParsedSession(session, events);
  parseCache.set(session.id, { mtimeMs: currentMtime, parsed });
  return parsed;
}

// ─── Dashboard builder ──────────────────────────────────────────────────────

export function buildDashboardState(): DashboardState {
  // 1. Get all active sessions
  const activeSessions = getActiveSessions();
  const activeSessionIds = new Set(activeSessions.map(s => s.id));

  // 2. Get recent sessions from all projects (for broader context)
  // Include active sessions plus recent sessions from active projects
  const allSessions = new Map<string, SessionInfo>();
  for (const s of activeSessions) {
    allSessions.set(s.id, s);
  }

  // Also pull recent sessions from projects that have active sessions
  const activeProjects = new Set(activeSessions.map(s => s.projectPath));
  const projects = listProjects();
  for (const project of projects) {
    if (!activeProjects.has(project.decodedPath)) continue;
    const sessions = listSessions(project.encodedName);
    // Include up to 3 most recent sessions per active project
    for (const s of sessions.slice(0, 3)) {
      allSessions.set(s.id, s);
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

  // 4. Detect collisions
  const collisions = detectCollisions(parsedSessions);
  const collisionFileSet = new Set(collisions.flatMap(c => c.agents.map(a => a.sessionId)));

  // 5. Build agents
  const agents: Agent[] = [];
  const projectAgentCounters = new Map<string, number>();

  for (const parsed of parsedSessions) {
    const projectPath = parsed.session.projectPath;
    const counter = (projectAgentCounters.get(projectPath) ?? 0) + 1;
    projectAgentCounters.set(projectPath, counter);

    const label = `agent-${counter}`;
    const isActive = activeSessionIds.has(parsed.session.id);
    const status = determineAgentStatus(parsed, isActive, collisionFileSet);

    const lastTurn = parsed.turns[parsed.turns.length - 1];
    const currentTask = lastTurn?.summary ?? "idle";

    agents.push({
      sessionId: parsed.session.id,
      label,
      status,
      currentTask,
      filesChanged: parsed.stats.filesChanged,
      projectPath,
      isActive,
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
    const completionPct = totalTurns > 0 ? Math.round((completedTurns / totalTurns) * 100) : 0;

    // Find the encoded project name for this path
    const project = projects.find(p => p.decodedPath === projectPath);
    const projectId = project?.encodedName ?? projectPath.replace(/\//g, "-");

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
    });
  }

  // Sort workstreams: active first, then by name
  workstreams.sort((a, b) => {
    const aActive = a.agents.some(ag => ag.isActive);
    const bActive = b.agents.some(ag => ag.isActive);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // 7. Build feed
  const feed = buildFeed(parsedSessions, collisions);

  // 8. Build summary
  const summary: DashboardSummary = {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.isActive).length,
    totalCollisions: collisions.length,
    criticalCollisions: collisions.filter(c => c.severity === "critical").length,
    totalWorkstreams: workstreams.length,
    totalCommits: workstreams.reduce((sum, w) => sum + w.commits, 0),
    totalErrors: workstreams.reduce((sum, w) => sum + w.errors, 0),
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
