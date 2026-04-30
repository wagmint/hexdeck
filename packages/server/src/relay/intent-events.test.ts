import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIntentEventsForTarget } from "./intent-events.js";
import { makeParsedSession, makeProviderSessionRef } from "../providers/test-helpers.js";
import type { DashboardState } from "../types/index.js";

vi.mock("../storage/repositories.js", () => ({
  getStoredSessionBranch: vi.fn(),
}));

vi.mock("../core/git-state.js", async () => {
  const actual = await vi.importActual<typeof import("../core/git-state.js")>("../core/git-state.js");
  return {
    ...actual,
    getLastKnownBranch: vi.fn(),
  };
});

import { getStoredSessionBranch } from "../storage/repositories.js";
import { getLastKnownBranch } from "../core/git-state.js";

afterEach(() => {
  vi.clearAllMocks();
});

function makeState(sessionId: string, projectPath = "/tmp/demo"): DashboardState {
  return {
    agents: [
      {
        sessionId,
        label: "jayce",
        agentType: "codex" as const,
        status: "busy",
        currentTask: "Implement branch attribution",
        filesChanged: [],
        uncommittedFiles: [],
        projectPath,
        isActive: true,
        plans: [],
        risk: {} as DashboardState["agents"][number]["risk"],
        operatorId: "self",
        recentTurns: [],
        skippedTurnCount: 0,
        blockedOn: undefined,
      },
    ],
    workstreams: [],
    collisions: [],
    localPlanCollisions: [],
    summary: {
      totalAgents: 1,
      activeAgents: 1,
      blockedAgents: 0,
      projects: 1,
      workstreams: 0,
      recentErrors: 0,
    },
    operators: [],
    feed: [],
  } as unknown as DashboardState;
}

describe("buildIntentEventsForTarget branch attribution", () => {
  it("prefers parsed session branch over stored and project cache branches", () => {
    vi.mocked(getStoredSessionBranch).mockReturnValue("stored-branch");
    vi.mocked(getLastKnownBranch).mockReturnValue("cached-branch");

    const ref = makeProviderSessionRef("codex", {
      id: "session-1",
      projectPath: "/tmp/demo",
    });
    const parsed = makeParsedSession(ref, { gitBranch: "parsed-branch" });

    const events = buildIntentEventsForTarget(makeState("session-1"), [parsed], ["/tmp/demo"]);
    const sessionStarted = events.find((event) => event.eventType === "session_started");

    expect(sessionStarted?.payload).toEqual(
      expect.objectContaining({ gitBranch: "parsed-branch" }),
    );
  });

  it("falls back to stored session branch when parsed branch is unavailable", () => {
    vi.mocked(getStoredSessionBranch).mockReturnValue("stored-branch");
    vi.mocked(getLastKnownBranch).mockReturnValue("cached-branch");

    const ref = makeProviderSessionRef("claude", {
      id: "session-2",
      projectPath: "/tmp/demo",
    });
    const parsed = makeParsedSession(ref, { gitBranch: null });

    const events = buildIntentEventsForTarget(makeState("session-2"), [parsed], ["/tmp/demo"]);
    const sessionUpdated = events.find((event) => event.eventType === "session_updated");

    expect(sessionUpdated?.payload).toEqual(
      expect.objectContaining({ gitBranch: "stored-branch" }),
    );
  });

  it("falls back to project cache when neither parsed nor stored branch exists", () => {
    vi.mocked(getStoredSessionBranch).mockReturnValue(null);
    vi.mocked(getLastKnownBranch).mockReturnValue("cached-branch");

    const ref = makeProviderSessionRef("claude", {
      id: "session-3",
      projectPath: "/tmp/demo",
    });
    const parsed = makeParsedSession(ref, { gitBranch: null });

    const events = buildIntentEventsForTarget(makeState("session-3"), [parsed], ["/tmp/demo"]);
    const sessionStarted = events.find((event) => event.eventType === "session_started");

    expect(sessionStarted?.payload).toEqual(
      expect.objectContaining({ gitBranch: "cached-branch" }),
    );
  });
});
