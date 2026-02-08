import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { listProjects, listSessions, findSession } from "../discovery/sessions.js";
import { parseSessionFile } from "../parser/jsonl.js";
import { buildParsedSession } from "../core/nodes.js";

const app = new Hono();

app.use("/*", cors({ origin: "http://localhost:3000" }));

// ─── API Routes ─────────────────────────────────────────────────────────────

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
      userInstruction: t.userInstruction,
      assistantPreview: t.assistantPreview,
      toolCounts: t.toolCounts,
      filesChanged: t.filesChanged,
      filesRead: t.filesRead,
      hasCommit: t.hasCommit,
      commitMessage: t.commitMessage,
      hasError: t.hasError,
      hasCompaction: t.hasCompaction,
      compactionText: t.compactionText,
      startLine: t.startLine,
      endLine: t.endLine,
    })),
    stats: parsed.stats,
  });
});

/** Health check */
app.get("/api/health", (c) => c.json({ status: "ok" }));

// ─── Server ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3002", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Pylon API running on http://localhost:${info.port}`);
});
