# Contributing to Hexdeck

Thanks for your interest in contributing to Hexdeck!

## Development Setup

```bash
git clone https://github.com/wagmint/hexdeck.git
cd hexdeck
npm install
```

### Running in development

```bash
npm run dev           # Runs Next.js dashboard (:3000) + API server (:3002)
npm run dev:server    # API server only
npm run dev:local     # Dashboard only
```

### Building

```bash
npm run build         # Builds all packages in order
```

Build order: `dashboard-ui` → `local` (Next.js) → `server` (tsc) → `cli` (tsup + copy dashboard)

### Project Structure

```
packages/
├── dashboard-ui/   # Shared React component library
├── local/          # Next.js dashboard (static export)
├── server/         # Hono API server + session parsing
└── cli/            # CLI tool (bundles server + dashboard)
```

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run build` to verify everything compiles
4. Open a pull request with a clear description of what changed and why

## Reporting Issues

- Use the [bug report template](https://github.com/wagmint/hexdeck/issues/new?template=bug_report.md) for bugs
- Use the [feature request template](https://github.com/wagmint/hexdeck/issues/new?template=feature_request.md) for ideas

## Code Style

- TypeScript throughout
- No lint config currently enforced — just match existing patterns
- Prefer small, focused PRs over large changes
