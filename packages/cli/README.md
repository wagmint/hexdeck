# @pylon-dev/cli

Local observability for Claude Code sessions.

```bash
npm install -g @pylon-dev/cli
pylon start
```

Opens a live dashboard at `http://localhost:3002` showing all your active Claude Code sessions — what agents are running, what files they're touching, and a turn-by-turn session inspector.

## Upgrade

```bash
npm install -g @pylon-dev/cli@latest
```

Required for current relay connect links (`?c=...` one-time code format).

## Commands

```bash
pylon start              # Start server + dashboard
pylon start --foreground # Run in foreground
pylon start --port 8080  # Custom port
pylon status             # Show server info
pylon stop               # Stop the server
pylon restart            # Restart
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

Connect link format:

```text
pylon+wss://relay.example.com/ws?p=<pylonId>&c=<connectCode>&n=<teamName>
```

## Requirements

- Node.js >= 20
- Claude Code installed (`~/.claude/projects/` must exist)

## License

MIT
