import { readdirSync, statSync, existsSync } from "fs";
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
 */
export function listProjects(): ProjectInfo[] {
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return [];

  const entries = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = join(CLAUDE_PROJECTS_DIR, entry.name);
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
 */
export function listSessions(projectIdentifier: string): SessionInfo[] {
  // Try as encoded name first
  let projectDir = join(CLAUDE_PROJECTS_DIR, projectIdentifier);

  if (!existsSync(projectDir)) {
    // Try encoding the path
    const encoded = encodeProjectPath(projectIdentifier);
    projectDir = join(CLAUDE_PROJECTS_DIR, encoded);
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
