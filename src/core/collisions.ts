import { execSync } from "child_process";
import { resolve } from "path";
import type { ParsedSession, Collision, CollisionSeverity } from "../types/index.js";

/**
 * Get the set of dirty (uncommitted) file paths for a project directory.
 * Uses `git status --porcelain` — returns absolute paths of modified/untracked files.
 */
function getDirtyFiles(projectPath: string): Set<string> {
  try {
    const output = execSync("git status --porcelain", {
      cwd: projectPath,
      encoding: "utf-8",
      timeout: 5000,
    });
    const dirty = new Set<string>();
    for (const line of output.split("\n")) {
      if (!line.trim()) continue;
      // porcelain format: "XY filename" or "XY filename -> renamed"
      const filePart = line.slice(3).split(" -> ").pop()!.trim();
      if (filePart) {
        dirty.add(resolve(projectPath, filePart));
      }
    }
    return dirty;
  } catch {
    // If git status fails, assume all files are dirty (safe fallback)
    return new Set(["*"]);
  }
}

/** Recency window fallback: only file edits within this many minutes count */
const RECENCY_MINUTES = 15;

/**
 * Get the timestamp of the most recent commit in a git repo.
 * Returns epoch (0) if no commits or git fails.
 */
function getLastCommitTime(projectPath: string): number {
  try {
    const output = execSync("git log -1 --format=%aI", {
      cwd: projectPath,
      encoding: "utf-8",
      timeout: 5000,
    });
    const ts = new Date(output.trim()).getTime();
    return isNaN(ts) ? 0 : ts;
  } catch {
    return 0;
  }
}

/**
 * Detect file collisions across parsed sessions.
 * A collision occurs when 2+ sessions recently modify the same file that is still
 * uncommitted (dirty) in the working tree.
 *
 * Two filters on each turn:
 *   1. Recency floor — max(last git commit time, now - RECENCY_MINUTES).
 *      Any commit (from any session or manual) resets the slate globally.
 *   2. Git dirty check — only files that are currently uncommitted
 */
export function detectCollisions(sessions: ParsedSession[], labelMap?: Map<string, string>): Collision[] {
  const now = Date.now();
  const recencyCutoff = now - RECENCY_MINUTES * 60 * 1000;

  // Per-project caches
  const dirtyByProject = new Map<string, Set<string>>();
  const commitTimeByProject = new Map<string, number>();

  function isDirty(projectPath: string, absolutePath: string): boolean {
    if (!dirtyByProject.has(projectPath)) {
      dirtyByProject.set(projectPath, getDirtyFiles(projectPath));
    }
    const dirty = dirtyByProject.get(projectPath)!;
    if (dirty.has("*")) return true;
    return dirty.has(absolutePath);
  }

  function getFloor(projectPath: string): number {
    if (!commitTimeByProject.has(projectPath)) {
      commitTimeByProject.set(projectPath, getLastCommitTime(projectPath));
    }
    // Use whichever is more recent: last commit or recency window
    return Math.max(commitTimeByProject.get(projectPath)!, recencyCutoff);
  }

  // Build map: normalized file path → list of agents who touched it
  const fileAgents = new Map<string, {
    sessionId: string;
    projectPath: string;
    label: string;
    lastAction: string;
  }[]>();

  for (const session of sessions) {
    const label = labelMap?.get(session.session.id) ?? session.session.id.slice(0, 8);
    const projectPath = session.session.projectPath;
    const floor = getFloor(projectPath);

    for (const turn of session.turns) {
      // Skip turns before the recency floor (last commit or time window)
      if (turn.timestamp.getTime() < floor) continue;

      for (const file of turn.filesChanged) {
        const normalized = normalizePath(file, projectPath);

        // Skip files that have been committed (no longer dirty)
        if (!isDirty(projectPath, normalized)) continue;

        if (!fileAgents.has(normalized)) {
          fileAgents.set(normalized, []);
        }

        const agents = fileAgents.get(normalized)!;
        // Only add this session once per file
        const existing = agents.find(a => a.sessionId === session.session.id);
        if (!existing) {
          agents.push({
            sessionId: session.session.id,
            projectPath,
            label,
            lastAction: turn.summary || "edited file",
          });
        } else {
          // Update with latest action
          existing.lastAction = turn.summary || "edited file";
        }
      }
    }
  }

  // Find collisions: files with 2+ different sessions
  const collisions: Collision[] = [];
  let idx = 0;

  for (const [filePath, agents] of fileAgents) {
    if (agents.length < 2) continue;

    // Check if they're from different sessions
    const uniqueSessions = new Set(agents.map(a => a.sessionId));
    if (uniqueSessions.size < 2) continue;

    // Determine severity
    const uniqueProjects = new Set(agents.map(a => a.projectPath));
    const severity: CollisionSeverity = uniqueProjects.size > 1 ? "critical" : "warning";

    collisions.push({
      id: `collision-${idx++}`,
      filePath,
      agents,
      severity,
      detectedAt: new Date(),
    });
  }

  // Sort critical first, then by file path
  return collisions.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return a.filePath.localeCompare(b.filePath);
  });
}

function normalizePath(filePath: string, projectPath: string): string {
  // If the path is already absolute, resolve it; otherwise resolve relative to project
  if (filePath.startsWith("/")) {
    return resolve(filePath);
  }
  return resolve(projectPath, filePath);
}
