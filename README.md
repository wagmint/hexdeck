# Hexdeck

**Local observability for Claude Code and Codex sessions.**

Hexdeck reads local session logs from Claude Code (`~/.claude/projects/`) and Codex (`~/.codex/sessions/`), parses them into structured turn-by-turn data, and serves a live dashboard showing what your agents are doing in real time.

<!-- TODO: Add a GIF/screenshot of the main dashboard here -->
<!-- ![Hexdeck Dashboard](docs/assets/dashboard.png) -->

## Install

```bash
npm install -g @hexdeck/cli
hex start
```

Opens `http://localhost:3002` with the dashboard. That's it.

### Menu bar app (macOS)

For an always-visible tray icon showing agent status:

```bash
brew tap wagmint/hexdeck
brew install --cask hexdeck
```

The menu bar app connects to the same local server — run `hex start` first.

## Upgrade

```bash
npm install -g @hexdeck/cli@latest
```

If you use Hexcore relay, upgrade before connecting new links.
Relay links now use short-lived one-time codes (`?c=...`) instead of embedded auth tokens.

## Features

### Live Dashboard
Real-time view of all active Claude Code and Codex sessions across your machine. See which agents are running, what files they're touching, and what they're working on — updated every second via SSE.

<!-- TODO: screenshot of dashboard with active sessions -->

### Collision Detection
Catch when two agents edit the same uncommitted file before it becomes a merge conflict. Hexdeck monitors git status and flags overlapping changes across sessions.

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
hex start              # Start server + dashboard (background)
hex start --foreground # Start in foreground
hex start --port 8080  # Custom port
hex status             # Show running server info
hex stop               # Stop the server
hex restart            # Restart
hex open               # Open dashboard in browser
```

Relay commands:

```bash
hex relay <connect-link>                  # Add/update relay target from cloud link
hex relay list                            # List relay targets
hex relay sessions                        # List active local sessions/projects
hex relay include <hexcoreId> <projectPath> # Start relaying project
hex relay exclude <hexcoreId> <projectPath> # Stop relaying project
hex relay remove <hexcoreId>                # Remove relay target
```

Example connect link format:

```text
hexcore+wss://relay.example.com/ws?p=<hexcoreId>&c=<connectCode>&n=<teamName>
```

## API

JSON API at `localhost:3002/api/` for building your own tooling.

| Endpoint | Description |
|---|---|
| `GET /api/projects` | List all projects with Claude Code and Codex sessions |
| `GET /api/projects/:name/sessions` | List sessions for a project |
| `GET /api/sessions/:id` | Parsed session with turn nodes and stats |
| `GET /api/sessions/active` | Currently active sessions |
| `GET /api/dashboard` | Full dashboard state |
| `GET /api/dashboard/stream` | SSE stream of dashboard updates |
| `GET /api/health` | Health check |

## How It Works

Claude Code stores session data under `~/.claude/projects/` and Codex stores session logs under `~/.codex/sessions/`. Hexdeck scans both sources, parses the events into structured **turn-pair nodes** (one user message + everything the agent did in response), and computes dashboard state including active agents, file collisions, risk signals, and a live feed.

The server is a single [Hono](https://hono.dev) process that serves both the API and the static dashboard.

## Development

```bash
git clone https://github.com/wagmint/hexdeck.git
cd hexdeck
npm install
npm run dev    # Next.js on :3000 + API on :3002
```

Build everything:

```bash
npm run build  # Builds dashboard-ui, dashboard, server, and CLI
```

## Requirements

- Node.js >= 20
- Claude Code and/or Codex installed (session logs in `~/.claude/projects/` and `~/.codex/sessions/`)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Hexcore

For cloud coordination across machines, use Hexcore:

- Cloud repo: https://github.com/wagmint/hexcore
- Cloud docs: https://hexcore.dev/docs

## License

MIT
