import { readdirSync, statSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, basename } from "path";
import { homedir } from "os";
import type { SessionInfo, ProjectInfo } from "../types/index.js";

const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");

/**
 * Get the Claude Code projects directory path.
 */
export function getProjectsDir(): string {
  return CLAUDE_PROJECTS_DIR;
}

/**
 * List all projects that have Claude Code sessions.
 * @param claudeDir Optional alternative .claude directory (defaults to ~/.claude)
 */
export function listProjects(claudeDir?: string): ProjectInfo[] {
  const projectsDir = claudeDir ? join(claudeDir, "projects") : CLAUDE_PROJECTS_DIR;
  if (!existsSync(projectsDir)) return [];

  const entries = readdirSync(projectsDir, { withFileTypes: true });
  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = join(projectsDir, entry.name);
    const sessions = listSessionsInDir(projectDir);

    if (sessions.length === 0) continue;

    const lastActive = sessions.reduce(
      (latest, s) => (s.modifiedAt > latest ? s.modifiedAt : latest),
      new Date(0)
    );

    projects.push({
      encodedName: entry.name,
      decodedPath: decodeProjectName(entry.name),
      sessionCount: sessions.length,
      lastActive,
    });
  }

  return projects.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
}

/**
 * List all sessions for a given project (by encoded name or original path).
 * @param claudeDir Optional alternative .claude directory (defaults to ~/.claude)
 */
export function listSessions(projectIdentifier: string, claudeDir?: string): SessionInfo[] {
  const projectsDir = claudeDir ? join(claudeDir, "projects") : CLAUDE_PROJECTS_DIR;
  // Try as encoded name first
  let projectDir = join(projectsDir, projectIdentifier);

  if (!existsSync(projectDir)) {
    // Try encoding the path
    const encoded = encodeProjectPath(projectIdentifier);
    projectDir = join(projectsDir, encoded);
  }

  if (!existsSync(projectDir)) return [];

  return listSessionsInDir(projectDir);
}

/**
 * Find the project that matches a given working directory.
 */
export function findProjectForPath(workingDir: string): ProjectInfo | null {
  const encoded = encodeProjectPath(workingDir);
  const projectDir = join(CLAUDE_PROJECTS_DIR, encoded);

  if (!existsSync(projectDir)) return null;

  const sessions = listSessionsInDir(projectDir);
  if (sessions.length === 0) return null;

  const lastActive = sessions.reduce(
    (latest, s) => (s.modifiedAt > latest ? s.modifiedAt : latest),
    new Date(0)
  );

  return {
    encodedName: encoded,
    decodedPath: workingDir,
    sessionCount: sessions.length,
    lastActive,
  };
}

/**
 * Get a specific session by ID across all projects.
 */
export function findSession(sessionId: string): SessionInfo | null {
  const projects = listProjects();

  for (const project of projects) {
    const sessions = listSessions(project.encodedName);
    const match = sessions.find((s) => s.id === sessionId);
    if (match) return match;
  }

  return null;
}

/**
 * Get all currently active sessions by finding running `claude` CLI processes
 * and matching their working directories to project session files.
 *
 * Approach: `lsof -c claude -Fn` gets the cwd of each claude process.
 * We map each cwd to its encoded project dir, then pick the most recently
 * modified JSONL file in that dir (the active session).
 */
/**
 * Sessions confirmed active in the previous poll.
 * Used as a grace buffer — sessions stay "active" for one extra cycle
 * to prevent flicker during session transitions (e.g., reset context).
 */
const previousActiveIds = new Set<string>();
const ACTIVE_GRACE_MS = 30_000; // 30 seconds
let lastActiveCheck = 0;

export function getActiveSessions(): SessionInfo[] {
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return [];

  try {
    // lsof -c claude -Fn outputs: p<pid>\nf<fd>\nn<path>\n...
    const output = execSync(
      `lsof -c claude -Fn 2>/dev/null || true`,
      { encoding: "utf-8", timeout: 5000 }
    );

    if (!output.trim()) return [];

    // Parse lsof output for BOTH cwd paths AND open .jsonl files
    const cwdPids = new Map<string, Set<string>>();
    const jsonlPids = new Map<string, Set<string>>(); // .jsonl path → PIDs
    const lines = output.split("\n");
    let currentPid: string | null = null;
    let isCwd = false;
    for (const line of lines) {
      if (line.startsWith("p")) {
        currentPid = line.slice(1);
        isCwd = false;
      } else if (line === "fcwd") {
        isCwd = true;
      } else if (line.startsWith("n") && currentPid) {
        const path = line.slice(1);
        if (isCwd) {
          if (path.startsWith("/") && !path.includes(".app/")) {
            if (!cwdPids.has(path)) cwdPids.set(path, new Set());
            cwdPids.get(path)!.add(currentPid);
          }
          isCwd = false;
        } else if (path.endsWith(".jsonl") && path.includes(".claude/projects/")) {
          // Direct PID → session file match
          if (!jsonlPids.has(path)) jsonlPids.set(path, new Set());
          jsonlPids.get(path)!.add(currentPid);
        }
      } else if (line.startsWith("f")) {
        isCwd = false;
      }
    }

    if (cwdPids.size === 0 && jsonlPids.size === 0) return [];

    const sessions: SessionInfo[] = [];
    const addedIds = new Set<string>();

    // Strategy 1: Use directly-matched .jsonl files (most reliable)
    for (const jsonlPath of jsonlPids.keys()) {
      const id = basename(jsonlPath, ".jsonl");
      if (addedIds.has(id)) continue;
      try {
        const stat = statSync(jsonlPath);
        const dir = jsonlPath.replace(/\/[^/]+\.jsonl$/, "");
        addedIds.add(id);
        sessions.push({
          id,
          path: jsonlPath,
          projectPath: decodeProjectName(basename(dir)),
          createdAt: stat.birthtime,
          modifiedAt: stat.mtime,
          sizeBytes: stat.size,
        });
      } catch { /* file vanished */ }
    }

    // Strategy 2: For remaining PIDs with cwd but no .jsonl match, use mtime heuristic
    const seenProjects = new Set<string>();
    for (const [cwd, pids] of cwdPids) {
      const encoded = encodeProjectPath(cwd);
      if (seenProjects.has(encoded)) continue;
      seenProjects.add(encoded);

      const projectDir = join(CLAUDE_PROJECTS_DIR, encoded);
      if (!existsSync(projectDir)) continue;

      const projectSessions = listSessionsInDir(projectDir);
      if (projectSessions.length === 0) continue;

      // How many sessions for this project are already matched via .jsonl?
      const alreadyMatched = projectSessions.filter(s => addedIds.has(s.id)).length;
      const remaining = Math.max(0, pids.size - alreadyMatched);

      // Take remaining slots from most recent sessions not yet matched
      let added = 0;
      for (const s of projectSessions) {
        if (added >= remaining) break;
        if (addedIds.has(s.id)) continue;
        addedIds.add(s.id);
        sessions.push(s);
        added++;
      }
    }

    // Strategy 3: Grace period — keep sessions from previous poll for stability
    const now = Date.now();
    if (now - lastActiveCheck < ACTIVE_GRACE_MS) {
      for (const prevId of previousActiveIds) {
        if (addedIds.has(prevId)) continue;
        // Session was active last poll but not this one — include if still recent
        const session = findSession(prevId);
        if (session && now - session.modifiedAt.getTime() < ACTIVE_GRACE_MS) {
          addedIds.add(prevId);
          sessions.push(session);
        }
      }
    }

    // Update the grace buffer
    previousActiveIds.clear();
    for (const id of addedIds) previousActiveIds.add(id);
    lastActiveCheck = now;

    return sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  } catch {
    return [];
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function listSessionsInDir(dir: string): SessionInfo[] {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir);
  const sessions: SessionInfo[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".jsonl")) continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    sessions.push({
      id: basename(entry, ".jsonl"),
      path: fullPath,
      projectPath: decodeProjectName(basename(dir)),
      createdAt: stat.birthtime,
      modifiedAt: stat.mtime,
      sizeBytes: stat.size,
    });
  }

  return sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

/**
 * Claude Code encodes project paths by replacing / with -.
 * e.g., /Users/jake/Code/kratos → -Users-jake-Code-kratos
 */
function decodeProjectName(encoded: string): string {
  // The encoding replaces path separators with dashes
  // Leading dash represents the root /
  if (encoded.startsWith("-")) {
    return "/" + encoded.slice(1).replace(/-/g, "/");
  }
  return encoded.replace(/-/g, "/");
}

function encodeProjectPath(path: string): string {
  return path.replace(/\//g, "-");
}
