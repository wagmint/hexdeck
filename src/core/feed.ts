import type { ParsedSession, Collision, FeedEvent } from "../types/index.js";

// ─── In-memory feed state ──────────────────────────────────────────────────

const MAX_FEED_SIZE = 200;

/** Append-only feed log, keyed by event ID */
const feedLog = new Map<string, FeedEvent>();

/** Currently active collisions, keyed by normalized file path */
const activeCollisions = new Map<string, { collision: Collision; detectedAt: Date }>();

/**
 * Build a unified feed of events from all sessions and detected collisions.
 * Maintains an append-only in-memory log with a moving window.
 * Turn-based events are re-derived each cycle (stable IDs prevent duplicates).
 * Collision/resolution events are tracked via diffing against previous state.
 */
export function buildFeed(
  sessions: ParsedSession[],
  collisions: Collision[],
  labelMap?: Map<string, string>,
  activeSessionIds?: Set<string>,
): FeedEvent[] {
  // 1. Derive turn-based events — stable IDs mean they're only added once
  for (const session of sessions) {
    const sessionId = session.session.id;
    const projectPath = session.session.projectPath;
    const label = labelMap?.get(sessionId) ?? sessionId.slice(0, 8);

    addEvent({
      id: `start-${sessionId}`,
      type: "start",
      timestamp: new Date(session.session.createdAt),
      agentLabel: label,
      sessionId,
      projectPath,
      message: `Session started in ${projectName(projectPath)}`,
    });

    for (let i = 0; i < session.turns.length; i++) {
      const turn = session.turns[i];
      const timestamp = turn.timestamp;

      if (turn.hasCommit) {
        addEvent({
          id: `commit-${sessionId}-${turn.index}`,
          type: "completion",
          timestamp,
          agentLabel: label,
          sessionId,
          projectPath,
          message: turn.commitMessage
            ? `Committed: ${turn.commitMessage}`
            : `Committed changes to ${turn.filesChanged.length} file(s)`,
        });
      }

      if (turn.hasError) {
        addEvent({
          id: `error-${sessionId}-${turn.index}`,
          type: "error",
          timestamp,
          agentLabel: label,
          sessionId,
          projectPath,
          message: `Error${turn.errorCount > 1 ? ` (${turn.errorCount}x)` : ""}: ${turn.summary || "encountered an error"}`,
        });
      }

      if (turn.hasCompaction) {
        addEvent({
          id: `compaction-${sessionId}-${turn.index}`,
          type: "compaction",
          timestamp,
          agentLabel: label,
          sessionId,
          projectPath,
          message: "Context compacted",
        });
      }

      if (turn.hasPlanStart) {
        addEvent({
          id: `plan-start-${sessionId}-${turn.index}`,
          type: "plan_started",
          timestamp,
          agentLabel: label,
          sessionId,
          projectPath,
          message: "Entered plan mode",
        });
      }

      if (turn.hasPlanEnd && !turn.planRejected) {
        addEvent({
          id: `plan-approved-${sessionId}-${turn.index}`,
          type: "plan_approved",
          timestamp,
          agentLabel: label,
          sessionId,
          projectPath,
          message: `Plan approved${turn.planMarkdown ? ": " + extractPlanTitle(turn.planMarkdown) : ""}`,
        });
      }

      for (const tu of turn.taskUpdates) {
        if (tu.status === "completed") {
          const task = findTaskSubject(session, tu.taskId);
          addEvent({
            id: `task-done-${sessionId}-${tu.taskId}-${turn.index}`,
            type: "task_completed",
            timestamp,
            agentLabel: label,
            sessionId,
            projectPath,
            message: `Completed: ${task ?? `task #${tu.taskId}`}`,
          });
        }
      }
    }
  }

  // 1b. Inject "session_ended" events for inactive sessions
  if (activeSessionIds) {
    for (const session of sessions) {
      const sessionId = session.session.id;
      if (!activeSessionIds.has(sessionId)) {
        const label = labelMap?.get(sessionId) ?? sessionId.slice(0, 8);
        addEvent({
          id: `session-ended-${sessionId}`,
          type: "session_ended",
          timestamp: new Date(session.session.modifiedAt),
          agentLabel: label,
          sessionId,
          projectPath: session.session.projectPath,
          message: "Session ended",
        });
      }
    }
  }

  // 2. Diff collisions — detect new and resolved
  const currentCollisionKeys = new Set<string>();

  for (const collision of collisions) {
    const key = collision.filePath;
    currentCollisionKeys.add(key);

    if (!activeCollisions.has(key)) {
      // New collision detected
      const detectedAt = new Date();
      activeCollisions.set(key, { collision, detectedAt });

      const agentLabels = collision.agents.map(a => a.label).join(" & ");
      addEvent({
        id: `collision-${key}-${detectedAt.getTime()}`,
        type: "collision",
        timestamp: detectedAt,
        agentLabel: agentLabels,
        sessionId: collision.agents[0]?.sessionId ?? "",
        projectPath: collision.agents[0]?.projectPath ?? "",
        message: `Collision on ${fileName(key)}: ${agentLabels} both modifying`,
        collisionId: collision.id,
      });
    }
  }

  // Resolved: was active, no longer in current set
  for (const [key, data] of activeCollisions) {
    if (!currentCollisionKeys.has(key)) {
      const agentLabels = data.collision.agents.map(a => a.label).join(" & ");
      addEvent({
        id: `collision-resolved-${key}-${Date.now()}`,
        type: "collision_resolved",
        timestamp: new Date(),
        agentLabel: agentLabels,
        sessionId: data.collision.agents[0]?.sessionId ?? "",
        projectPath: data.collision.agents[0]?.projectPath ?? "",
        message: `Resolved collision on ${fileName(key)}`,
      });
      activeCollisions.delete(key);
    }
  }

  // 3. Trim to moving window (drop oldest)
  if (feedLog.size > MAX_FEED_SIZE) {
    const sorted = [...feedLog.entries()].sort(
      (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
    );
    const toRemove = sorted.slice(0, feedLog.size - MAX_FEED_SIZE);
    for (const [id] of toRemove) {
      feedLog.delete(id);
    }
  }

  // 4. Return sorted newest-first
  return [...feedLog.values()].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

/** Add event to feedLog if not already present (append-only). */
function addEvent(event: FeedEvent): void {
  if (!feedLog.has(event.id)) {
    feedLog.set(event.id, event);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function projectName(projectPath: string): string {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

function fileName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

function extractPlanTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)/m);
  return match ? match[1].slice(0, 60) : "implementation plan";
}

function findTaskSubject(session: ParsedSession, taskId: string): string | null {
  for (const turn of session.turns) {
    const tc = turn.taskCreates.find(t => t.taskId === taskId);
    if (tc) return tc.subject;
  }
  return null;
}
