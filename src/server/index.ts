import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { listProjects, listSessions, findSession, getActiveSessions } from "../discovery/sessions.js";
import { parseSessionFile } from "../parser/jsonl.js";
import { buildParsedSession } from "../core/nodes.js";
import { buildDashboardState } from "../core/dashboard.js";

const app = new Hono();

app.use("/*", cors({ origin: ["http://localhost:3000", "http://localhost:3001"] }));

// ─── API Routes ─────────────────────────────────────────────────────────────

/** List currently active sessions */
app.get("/api/sessions/active", (c) => {
  const sessions = getActiveSessions();
  return c.json(
    sessions.map((s) => ({
      id: s.id,
      projectPath: s.projectPath,
      createdAt: s.createdAt.toISOString(),
      modifiedAt: s.modifiedAt.toISOString(),
      sizeBytes: s.sizeBytes,
    }))
  );
});

/** List all projects with Claude Code sessions */
app.get("/api/projects", (c) => {
  const projects = listProjects();
  return c.json(
    projects.map((p) => ({
      encodedName: p.encodedName,
      decodedPath: p.decodedPath,
      sessionCount: p.sessionCount,
      lastActive: p.lastActive.toISOString(),
    }))
  );
});

/** List sessions for a project */
app.get("/api/projects/:encodedName/sessions", (c) => {
  const { encodedName } = c.req.param();
  const sessions = listSessions(encodedName);
  return c.json(
    sessions.map((s) => ({
      id: s.id,
      projectPath: s.projectPath,
      createdAt: s.createdAt.toISOString(),
      modifiedAt: s.modifiedAt.toISOString(),
      sizeBytes: s.sizeBytes,
    }))
  );
});

/** Get a parsed session with turn-pair nodes */
app.get("/api/sessions/:sessionId", (c) => {
  const { sessionId } = c.req.param();
  const session = findSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const events = parseSessionFile(session.path);
  const parsed = buildParsedSession(session, events);

  return c.json({
    session: {
      id: parsed.session.id,
      projectPath: parsed.session.projectPath,
      createdAt: parsed.session.createdAt.toISOString(),
      modifiedAt: parsed.session.modifiedAt.toISOString(),
      sizeBytes: parsed.session.sizeBytes,
    },
    turns: parsed.turns.map((t) => ({
      id: t.id,
      index: t.index,
      summary: t.summary,
      category: t.category,
      userInstruction: t.userInstruction,
      assistantPreview: t.assistantPreview,
      sections: t.sections,
      toolCounts: t.toolCounts,
      filesChanged: t.filesChanged,
      filesRead: t.filesRead,
      commands: t.commands,
      hasCommit: t.hasCommit,
      commitMessage: t.commitMessage,
      hasError: t.hasError,
      errorCount: t.errorCount,
      hasCompaction: t.hasCompaction,
      compactionText: t.compactionText,
      startLine: t.startLine,
      endLine: t.endLine,
    })),
    stats: parsed.stats,
  });
});

// ─── Dashboard Routes ────────────────────────────────────────────────────────

function serializeDate(d: Date): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

/** Full dashboard state */
app.get("/api/dashboard", (c) => {
  const state = buildDashboardState();
  return c.json({
    ...state,
    collisions: state.collisions.map((col) => ({
      ...col,
      detectedAt: serializeDate(col.detectedAt),
    })),
    feed: state.feed.map((ev) => ({
      ...ev,
      timestamp: serializeDate(ev.timestamp),
    })),
  });
});

/** Dashboard feed only */
app.get("/api/dashboard/feed", (c) => {
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const state = buildDashboardState();
  const feed = state.feed.slice(0, limit);
  return c.json(
    feed.map((ev) => ({
      ...ev,
      timestamp: serializeDate(ev.timestamp),
    }))
  );
});

/** Dashboard collisions only */
app.get("/api/dashboard/collisions", (c) => {
  const state = buildDashboardState();
  return c.json(
    state.collisions.map((col) => ({
      ...col,
      detectedAt: serializeDate(col.detectedAt),
    }))
  );
});

/** Health check */
app.get("/api/health", (c) => c.json({ status: "ok" }));

// ─── Server ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3002", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Pylon API running on http://localhost:${info.port}`);
});
