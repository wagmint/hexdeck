# Hexdeck

Real-time dashboard for your Claude Code sessions.

See what your agents are doing, track plans and progress, detect file collisions, and monitor costs — all locally.

```bash
npm install -g @hexdeck/cli
hex start
```

Opens a live dashboard at `http://localhost:3002`.

## What You Get

- **Live agent monitoring** — see every active session, what it's working on, files touched
- **Plan tracking** — watch agent plans from drafting through implementation to completion
- **Collision detection** — get alerted when multiple agents edit the same file
- **Risk analytics** — error rates, cost tracking, context usage, spinning detection
- **Intent mapping** — planned vs actual work, drift detection
- **Multi-operator support** — color-coded agents across operators

## Privacy

Hexdeck runs entirely on your machine. No data is sent externally.

| | Details |
|---|---|
| **Reads** | `~/.claude/projects/` (session logs), `git status` (collision detection) |
| **Writes** | `~/.hexdeck/` (pid file, config, plan index) |
| **Network** | `localhost` only — zero outbound connections |
| **Telemetry** | None. No analytics, no tracking, no phone-home. |

Cloud relay is available for team use but is strictly opt-in, per-project, and shows exactly what data is being sent.

## Commands

```bash
hex start              # Start server + dashboard
hex start --foreground # Run in foreground
hex start --port 8080  # Custom port
hex status             # Show server info
hex stop               # Stop the server
hex restart            # Restart
hex open               # Open dashboard in browser
```

## Requirements

- Node.js >= 20
- Claude Code installed (`~/.claude/projects/` must exist)

## Upgrade

```bash
npm install -g @hexdeck/cli@latest
```

## Hexcore

For teams running multiple operators on the same codebase, Hexcore adds multiplayer coordination — shared dashboards, cross-operator collision detection, and team presence.

## License

MIT
