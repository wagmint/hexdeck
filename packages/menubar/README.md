# Hexdeck Menu Bar App

macOS menu bar app for monitoring AI coding agents at a glance. Built with Tauri v2 + React.

## Install

**Homebrew:**

```bash
brew tap wagmint/hexdeck && brew install --cask hexdeck
```

**Direct download:** grab the `.dmg` for your architecture from [the latest release](https://github.com/wagmint/hexdeck/releases/latest).

The menu bar app connects to the local Hexdeck server — you need the CLI running (`hex start`) for it to work.

## What it does

A color-coded tray icon shows the overall state of your agents:

- **Blue** — an agent is actively working
- **Green** — agents are online, no issues
- **Yellow** — something needs attention
- **Red** — a critical issue (e.g. a collision between agents)
- **Grey** — no active agents or disconnected

Click the icon to see active agents and current alerts.
Use the tray icon's right-click menu to toggle the floating widget on/off.

## Keyboard shortcut

Global shortcut to open/focus the popup:

- `Cmd+Ctrl+H`

The same shortcut is shown in the tray icon's right-click menu.

## Auto-updates

The app checks for updates on launch and silently installs them. No manual updating needed.

## Development

Requires: Node 22+, Rust stable, [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
# from the monorepo root
npm install

# run in dev mode
cd packages/menubar
npm run dev
```

## Releasing

Push a tag to trigger the release workflow:

```bash
# 1. Bump version in src-tauri/tauri.conf.json
# 2. Commit and push to main
git tag menubar-v0.2.0
git push origin menubar-v0.2.0
```

This builds for both Apple Silicon and Intel, creates a GitHub Release with signed update bundles, and updates the Homebrew tap.

## Tech stack

- [Tauri v2](https://v2.tauri.app/) — native app shell
- React 19 + Tailwind CSS — UI
- Vite — frontend bundler
- [tauri-plugin-updater](https://v2.tauri.app/plugin/updater/) — auto-updates
