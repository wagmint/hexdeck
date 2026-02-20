import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";
import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { listProjects, listSessions, findSession, getActiveSessions } from "../discovery/sessions.js";
import { parseSessionFile } from "../parser/jsonl.js";
import { buildParsedSession } from "../core/nodes.js";
import { buildDashboardState } from "../core/dashboard.js";
import { relayManager } from "../relay/manager.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StartServerOptions {
  port?: number;
  dashboardDir?: string;
}

// ─── Dashboard Helpers ───────────────────────────────────────────────────────

function serializeDate(d: Date): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function serializeState(state: ReturnType<typeof buildDashboardState>) {
  return {
    ...state,
    collisions: state.collisions.map((col) => ({
      ...col,
      detectedAt: serializeDate(col.detectedAt),
    })),
    feed: state.feed.map((ev) => ({
      ...ev,
      timestamp: serializeDate(ev.timestamp),
    })),
  };
}

// ─── SSE Client Management ──────────────────────────────────────────────────

interface SSEClient {
  stream: SSEStreamingApi;
}

const clients = new Set<SSEClient>();
let lastPushedJson = "";
let tickerInterval: ReturnType<typeof setInterval> | null = null;
let sseMessageId = 0;

function shouldTickerRun() {
  return clients.size > 0 || relayManager.hasTargets;
}

function startTicker() {
  if (tickerInterval) return;
  tickerInterval = setInterval(() => {
    const rawState = buildDashboardState();

    // Relay (does its own diff check per connection)
    relayManager.onStateUpdate(rawState);

    // SSE (existing logic)
    const data = serializeState(rawState);
    const json = JSON.stringify(data);
    if (json === lastPushedJson) return;
    lastPushedJson = json;
    sseMessageId++;
    const id = String(sseMessageId);
    for (const client of clients) {
      client.stream.writeSSE({ data: json, event: "state", id }).catch(() => {
        // Client disconnected — will be cleaned up by onAbort
      });
    }
  }, 1000);
}

function stopTicker() {
  if (tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
  }
}

function addClient(client: SSEClient) {
  clients.add(client);
  if (shouldTickerRun()) startTicker();
}

function removeClient(client: SSEClient) {
  clients.delete(client);
  if (!shouldTickerRun()) stopTicker();
}

// ─── App Factory ─────────────────────────────────────────────────────────────

export function createApp(options?: { dashboardDir?: string }): Hono {
  const app = new Hono();

  app.use("/*", cors());

  // ─── API Routes ───────────────────────────────────────────────────────────

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

  // ─── Dashboard Routes ─────────────────────────────────────────────────────

  /** Full dashboard state */
  app.get("/api/dashboard", (c) => {
    return c.json(serializeState(buildDashboardState()));
  });

  /** SSE stream — pushes dashboard state on change */
  app.get("/api/dashboard/stream", (c) => {
    return streamSSE(c, async (stream) => {
      const client: SSEClient = { stream };

      // Send current state immediately
      const data = serializeState(buildDashboardState());
      const json = JSON.stringify(data);
      sseMessageId++;
      await stream.writeSSE({ data: json, event: "state", id: String(sseMessageId) });

      addClient(client);

      // Block until the client disconnects
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          removeClient(client);
          resolve();
        });
      });
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

  // ─── Static Dashboard Serving ─────────────────────────────────────────────

  const dashboardDir = options?.dashboardDir;

  if (dashboardDir) {
    // Serve static files from the Next.js export directory
    app.use("/*", serveStatic({ root: dashboardDir }));

    // SPA fallback for /session/:id routes
    app.get("/session/:id{.+}", async (c) => {
      const html = fs.readFileSync(path.join(dashboardDir, "session", "_.html"), "utf-8");
      return c.html(html);
    });

    // Catch-all fallback — serves index.html
    app.get("*", async (c) => {
      const html = fs.readFileSync(path.join(dashboardDir, "index.html"), "utf-8");
      return c.html(html);
    });
  }

  return app;
}

// ─── Server Starter ──────────────────────────────────────────────────────────

export function startServer(options?: StartServerOptions): ServerType {
  const port = options?.port ?? parseInt(process.env.PORT ?? "3002", 10);
  const app = createApp({ dashboardDir: options?.dashboardDir });

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Pylon running on http://localhost:${info.port}`);
    if (options?.dashboardDir) {
      console.log(`Dashboard: http://localhost:${info.port}`);
    }
  });

  // Start relay manager (connects to configured relay targets)
  relayManager.start();
  if (relayManager.hasTargets) startTicker();

  return server;
}
