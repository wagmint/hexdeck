# Pylon

**Local observability for Claude Code sessions.**

Pylon reads the JSONL session files Claude Code writes to `~/.claude/projects/`, parses them into structured turn-by-turn data, and serves a live dashboard showing what your agents are doing in real time.

<!-- TODO: Add a GIF/screenshot of the main dashboard here -->
<!-- ![Pylon Dashboard](docs/assets/dashboard.png) -->

## Install

```bash
npm install -g @pylon-dev/cli
pylon start
```

Opens `http://localhost:3002` with the dashboard. That's it.

### Menu bar app (macOS)

For an always-visible tray icon showing agent status:

```bash
brew tap wagmint/pylon
brew install --cask pylon
```

The menu bar app connects to the same local server — run `pylon start` first.

## Upgrade

```bash
npm install -g @pylon-dev/cli@latest
```

If you use Pylon Cloud relay, upgrade before connecting new links.
Relay links now use short-lived one-time codes (`?c=...`) instead of embedded auth tokens.

## Features

### Live Dashboard
Real-time view of all active Claude Code sessions across your machine. See which agents are running, what files they're touching, and what they're working on — updated every second via SSE.

<!-- TODO: screenshot of dashboard with active sessions -->

### Collision Detection
Catch when two agents edit the same uncommitted file before it becomes a merge conflict. Pylon monitors git status and flags overlapping changes across sessions.

<!-- TODO: screenshot of collision alert -->

### Session Inspector
Drill into any session to see the full turn-by-turn breakdown: user instructions, tool calls, files changed, commits, errors, and compactions.

<!-- TODO: screenshot of session detail view -->

### Risk Analytics
Track error rates, spinning signals (agents stuck in loops), compaction proximity, file hotspots, and cost per session.

### Live Feed
Real-time event stream of agent activity — session starts, commits, errors, compactions, plan changes — across all your projects.

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

Relay commands:

```bash
pylon relay <connect-link>                  # Add/update relay target from cloud link
pylon relay list                            # List relay targets
pylon relay sessions                        # List active local sessions/projects
pylon relay include <pylonId> <projectPath> # Start relaying project
pylon relay exclude <pylonId> <projectPath> # Stop relaying project
pylon relay remove <pylonId>                # Remove relay target
```

Example connect link format:

```text
pylon+wss://relay.example.com/ws?p=<pylonId>&c=<connectCode>&n=<teamName>
```

## API

JSON API at `localhost:3002/api/` for building your own tooling.

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

Claude Code stores session data as JSONL files in `~/.claude/projects/`. Pylon scans these files, parses the events into structured **turn-pair nodes** (one user message + everything Claude did in response), and computes dashboard state including active agents, file collisions, risk signals, and a live feed.

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
npm run build  # Builds dashboard-ui, dashboard, server, and CLI
```

## Requirements

- Node.js >= 20
- Claude Code installed (creates session files in `~/.claude/projects/`)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
