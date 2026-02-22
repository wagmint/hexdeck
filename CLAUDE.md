# Pylon — Claude Code Project Instructions

## Version Bumping

After making changes to packages, always prompt the user to bump versions before they publish:

- **`@pylon-dev/dashboard-ui`** — bump when any file in `packages/dashboard-ui/src/` changes: `make dashboard-version` (then publish)
- **`@pylon-dev/cli`** — bump when any file in `packages/cli/`, `packages/server/`, or `packages/local/` changes: `make cli-version` (then rebuild + publish)

Reminder: CLI bundles both the server and dashboard static files, so changes to server or local also require a CLI version bump.

## Build & Publish

```bash
make build                    # Build all packages (dashboard-ui → local → server → cli)
make dashboard-version        # Bump dashboard-ui (default: patch)
make cli-version              # Bump CLI (default: patch)
npm publish -w packages/dashboard-ui --access public --otp=<code>
npm publish -w packages/cli --access public --otp=<code>
```

## Project Structure

- `packages/dashboard-ui` — shared React component library (published to npm)
- `packages/local` — Next.js dashboard (static export, bundled into CLI)
- `packages/server` — Hono API server + JSONL parser (inlined into CLI by tsup)
- `packages/cli` — CLI tool (published to npm, bundles server + dashboard)

## Workspace Dependencies

Uses npm workspaces. Internal dep refs use `"*"` not `"workspace:*"`.
