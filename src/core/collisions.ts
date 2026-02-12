import { resolve, basename } from "path";
import type { ParsedSession, Collision, CollisionSeverity } from "../types/index.js";

/**
 * Detect file collisions across parsed sessions.
 * A collision occurs when 2+ sessions modify the same file.
 */
export function detectCollisions(sessions: ParsedSession[]): Collision[] {
  // Build map: normalized file path → list of agents who touched it
  const fileAgents = new Map<string, {
    sessionId: string;
    projectPath: string;
    label: string;
    lastAction: string;
  }[]>();

  for (const session of sessions) {
    const label = session.session.id.slice(0, 8);
    const projectPath = session.session.projectPath;

    for (const turn of session.turns) {
      for (const file of turn.filesChanged) {
        const normalized = normalizePath(file, projectPath);
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
