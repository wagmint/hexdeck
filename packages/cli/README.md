# @pylon/cli

Local observability for Claude Code sessions.

```bash
npm install -g @pylon/cli
pylon start
```

Opens a live dashboard at `http://localhost:3002` showing all your active Claude Code sessions — what agents are running, what files they're touching, and a turn-by-turn session inspector.

## Commands

```bash
pylon start              # Start server + dashboard
pylon start --foreground # Run in foreground
pylon start --port 8080  # Custom port
pylon status             # Show server info
pylon stop               # Stop the server
pylon restart            # Restart
```

## Requirements

- Node.js >= 20
- Claude Code installed (`~/.claude/projects/` must exist)

## License

MIT
