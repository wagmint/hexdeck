import type { ParsedSession, Collision, FeedEvent, FeedEventType } from "../types/index.js";

/**
 * Build a unified feed of events from all sessions and detected collisions.
 */
export function buildFeed(
  sessions: ParsedSession[],
  collisions: Collision[],
  limit = 50
): FeedEvent[] {
  const events: FeedEvent[] = [];

  for (const session of sessions) {
    const sessionId = session.session.id;
    const projectPath = session.session.projectPath;
    const label = sessionId.slice(0, 8);
    const totalTurns = session.turns.length;

    // Session start event
    events.push({
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
      const timestamp = interpolateTimestamp(
        session.session.createdAt,
        session.session.modifiedAt,
        i,
        totalTurns
      );

      if (turn.hasCommit) {
        events.push({
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
        events.push({
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
        events.push({
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
        events.push({
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
        events.push({
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
          events.push({
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

  // Add collision events
  for (const collision of collisions) {
    const agentLabels = collision.agents.map(a => a.label).join(" & ");
    events.push({
      id: `collision-event-${collision.id}`,
      type: "collision",
      timestamp: collision.detectedAt,
      agentLabel: agentLabels,
      sessionId: collision.agents[0]?.sessionId ?? "",
      projectPath: collision.agents[0]?.projectPath ?? "",
      message: `Collision on ${fileName(collision.filePath)}: ${agentLabels} both modifying`,
      collisionId: collision.id,
    });
  }

  // Sort newest first, cap at limit
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return events.slice(0, limit);
}

/**
 * Interpolate a timestamp for a turn based on its position within the session.
 */
function interpolateTimestamp(
  createdAt: Date,
  modifiedAt: Date,
  turnIndex: number,
  totalTurns: number
): Date {
  if (totalTurns <= 1) return new Date(modifiedAt);
  const start = new Date(createdAt).getTime();
  const end = new Date(modifiedAt).getTime();
  const fraction = turnIndex / (totalTurns - 1);
  return new Date(start + fraction * (end - start));
}

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
