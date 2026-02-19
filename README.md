# Pylon

Local observability for Claude Code sessions.

Pylon reads the JSONL session files Claude Code creates (`~/.claude/projects/`), parses them into structured data, and serves a live dashboard showing what your agents are doing.

## Quick Start

```bash
npm install -g @pylon-dev/cli
pylon start
```

Opens `http://localhost:3002` with the dashboard.

## What It Does

**Dashboard** — live view of all active Claude Code sessions across your machine. See which agents are running, what files they're touching, and catch collisions before they happen.

**Session Inspector** — drill into any session to see the full turn-by-turn breakdown: user instructions, tool calls, files changed, commits, errors, and compactions.

**API** — JSON API at `localhost:3002/api/` for building your own tooling on top.

## Commands

```bash
pylon start              # Start server + dashboard (background)
pylon start --foreground # Start in foreground
pylon start --port 8080  # Custom port
pylon status             # Show running server info
pylon stop               # Stop the server
pylon restart            # Restart
pylon open               # Open dashboard in browser
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/projects` | List all projects with Claude Code sessions |
| `GET /api/projects/:name/sessions` | List sessions for a project |
| `GET /api/sessions/:id` | Parsed session with turn nodes and stats |
| `GET /api/sessions/active` | Currently active sessions |
| `GET /api/dashboard` | Full dashboard state |
| `GET /api/dashboard/stream` | SSE stream of dashboard updates |
| `GET /api/health` | Health check |

## How It Works

Claude Code stores session data as JSONL files in `~/.claude/projects/`. Pylon scans these files, parses the events into structured turn-pair nodes (one user message + everything Claude did in response), and computes dashboard state including active agents, file collisions, and a live feed.

The server is a single [Hono](https://hono.dev) process that serves both the API and the static dashboard.

## Development

```bash
git clone https://github.com/wagmint/pylon.git
cd pylon
npm install
npm run dev    # Next.js on :3000 + API on :3002
```

Build everything:

```bash
npm run build  # Builds dashboard, server, and CLI
```

## Requirements

- Node.js >= 20
- Claude Code installed (session files in `~/.claude/projects/`)

## License

MIT
