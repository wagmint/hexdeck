import type { ParsedSession, TurnNode } from "../types/index.js";

export const CODEX_BUSY_WINDOW_MS = 8_000;
export const CODEX_SETTLE_MS = 3_000;
export const CODEX_PROCESS_GRACE_MS = 15_000;

export interface CodexStatusInput {
  nowMs: number;
  sessionMtimeMs: number;
  runtime?: ParsedSession["codexRuntime"];
  lastTurn?: TurnNode;
}

/**
 * Codex-only busy/idle resolver.
 * Claude uses hook-driven status and should not call this.
 */
export function resolveCodexBusyIdle(input: CodexStatusInput): "busy" | "idle" {
  const { nowMs, sessionMtimeMs, runtime, lastTurn } = input;
  const lastEventAtMs = runtime?.lastEventAt?.getTime() ?? sessionMtimeMs;
  const lastToolAtMs =
    runtime?.lastToolActivityAt?.getTime()
    ?? (lastTurn ? inferLastTurnActivityMs(lastTurn) : 0)
    ?? 0;
  const inTurn = runtime?.inTurn ?? Boolean(lastTurn && lastTurn.durationMs === null);

  if (inTurn) {
    const recentMs = Math.max(lastEventAtMs, lastToolAtMs);
    return nowMs - recentMs <= CODEX_BUSY_WINDOW_MS ? "busy" : "idle";
  }

  if (
    runtime?.lastEventType
    && (runtime.lastEventType === "turn_complete" || runtime.lastEventType === "shutdown")
    && nowMs - lastEventAtMs > CODEX_SETTLE_MS
  ) {
    return "idle";
  }

  if (lastToolAtMs > 0 && nowMs - lastToolAtMs <= CODEX_BUSY_WINDOW_MS) {
    return "busy";
  }

  if (nowMs - lastEventAtMs > CODEX_PROCESS_GRACE_MS) {
    return "idle";
  }

  return nowMs - lastEventAtMs <= CODEX_SETTLE_MS ? "busy" : "idle";
}

function inferLastTurnActivityMs(turn: TurnNode): number {
  if (turn.durationMs !== null) return turn.timestamp.getTime() + turn.durationMs;
  return turn.timestamp.getTime();
}
