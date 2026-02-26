# Hexdeck — Checkpoints for Claude Code

Hexdeck is the observability and navigation layer for Claude Code sessions. It reads the JSONL session files Claude Code already creates (~/.claude/projects/), parses them into structured turn-pair nodes, and gives you checkpoints you can rewind to — like git commits but for your entire AI coding session (code state + conversation state).

## Why this exists

Claude Code has session forking (`--fork-session`), resume (`--continue`/`--resume`), and file checkpoints (Esc Esc to rewind) built in. But there's no visibility into any of it. You can't see how sessions relate, can't browse what happened, can't create named save points to rewind to. Hexdeck is that missing layer.

## What's built (v0)

### Core engine (`src/`)

**Session discovery** (`src/discovery/sessions.ts`)
- Scans `~/.claude/projects/` for all Claude Code session files
- Lists projects, sessions, finds sessions by UUID
- Handles Claude Code's path encoding (`/Users/jake/Code` → `-Users-jake-Code`)

**JSONL parser** (`src/parser/jsonl.ts`)
- Parses Claude Code session JSONL files into typed events
- Normalizes different message formats (direct, wrapped, event wrapper)
- Extraction helpers: getMessageText, getToolCalls, getToolResults, hasCompaction, getCompactionText, getSessionStats

**Turn-pair node detection** (`src/core/nodes.ts`)
- Groups flat events into "turns" — one user message + everything Claude did until the next user message
- Each TurnNode captures: user instruction, tools used, files changed, files read, commits, errors, compaction
- `buildParsedSession()` creates full session stats

**Checkpoint system** (`src/checkpoint/`)
- `create.ts` — Creates a checkpoint capturing: JSONL line count, git commit hash, git diff, branch, changed files, user note
- `rewind.ts` — Rewinds to a checkpoint by: copying JSONL, truncating to checkpoint line, rewriting session IDs, saving as new session file in `~/.claude/projects/`. Optionally restores git state.
- `storage.ts` — Stores checkpoints in `~/.hexdeck/checkpoints/<encoded-project>.json`

**Key technical discovery:** Claude Code JSONL files can be truncated at clean turn boundaries and resumed via `claude --resume`. The uuid/parentUuid thread links remain intact. This was tested and validated — truncated sessions load cleanly in Claude Code.

**JSONL format details** (from investigation):
- Each line has: `uuid`, `parentUuid` (threading), `timestamp`, `sessionId`, `type`, `cwd`, `version`, `gitBranch`
- Line types: `user`, `assistant`, `progress`, `file-history-snapshot`, `system`, `summary`
- `file-history-snapshot` lines contain Claude Code's internal file snapshots
- Lines are threaded via uuid/parentUuid — truncation works if you cut at turn boundaries

### API server (`src/server/index.ts`)
- Hono server on port 7433
- `GET /api/projects` — list all projects
- `GET /api/projects/:name/sessions` — list sessions for a project
- `GET /api/sessions/:id` — full parsed session with turn nodes and stats
- CORS enabled for frontend on localhost:3000

### CLI (`src/cli/`)
- `index.ts` — Main hexdeck CLI:
  - `hex checkpoint <note>` — create a checkpoint
  - `hex rewind <checkpoint-id>` — rewind to checkpoint (creates truncated JSONL + restores git)
  - `hex checkpoints` — list all checkpoints
- `parse.ts` — Legacy parse CLI: projects, sessions, parse commands

### Frontend (`frontend/`)
- Next.js 15 + React 19 + Tailwind + React Flow (matches Lantern's patterns)
- Dark dev-tool aesthetic (Inter + JetBrains Mono fonts)
- Home page: project list with expandable sessions
- Session detail page (`/session/[id]`): React Flow canvas with turn-pair nodes, click for side panel with full details
- API client in `frontend/src/lib/api.ts`
- **Status: scaffolded, not yet tested in browser**

### Types (`src/types/index.ts`)
Key types: SessionEvent, Message, ContentBlock (TextContent | ToolUseContent | ToolResultContent | CompactionContent), SessionInfo, ProjectInfo, TurnNode, ParsedSession, Checkpoint. Also has future tree types: TreeNode, Branch, CompactionSnapshot, ResumeEvent, SessionTree.

## How to run

```bash
# From hexdeck/
make start          # Start API server on :7433
cd frontend && npm run dev  # Start frontend on :3000

# Checkpoints (run from your project directory)
npm run hex -- checkpoint "my save point"
npm run hex -- checkpoints
npm run hex -- rewind <checkpoint-id>
```

## Directory structure

```
hexdeck/
├── src/
│   ├── types/index.ts           # All type definitions
│   ├── parser/jsonl.ts          # JSONL parser + helpers
│   ├── discovery/sessions.ts    # Session/project discovery
│   ├── core/nodes.ts            # Turn-pair node detection
│   ├── checkpoint/
│   │   ├── create.ts            # Create checkpoints
│   │   ├── rewind.ts            # Rewind to checkpoints
│   │   └── storage.ts           # Checkpoint persistence
│   ├── server/index.ts          # Hono API server
│   ├── cli/
│   │   ├── index.ts             # Main hexdeck CLI
│   │   └── parse.ts             # Legacy parse CLI
│   └── index.ts                 # Public exports
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # Root layout
│   │   │   ├── page.tsx         # Project/session browser
│   │   │   ├── globals.css      # Dark theme CSS variables
│   │   │   └── session/[id]/page.tsx  # Session detail with React Flow
│   │   ├── components/
│   │   │   ├── TurnFlow.tsx     # React Flow canvas with turn nodes
│   │   │   ├── NodePanel.tsx    # Side panel with turn details
│   │   │   └── SessionHeader.tsx # Stats bar
│   │   └── lib/
│   │       ├── api.ts           # Fetch wrapper
│   │       ├── types.ts         # Frontend types
│   │       └── utils.ts         # cn(), formatBytes(), timeAgo()
│   ├── package.json             # Next.js 15, React 19, @xyflow/react, Tailwind, Framer Motion, Lucide
│   └── tailwind.config.ts
├── docs/                        # Research docs
├── package.json                 # Hono, tsx, TypeScript, Vitest
├── Makefile
└── tsconfig.json
```

## What's next

### Near-term
- **Make it `npx hex`** — restructure as publishable npm package with bin entry, auto-starts API + opens web UI, works from any directory
- **Verify frontend works** — open in browser, fix rendering bugs
- **Polling/live updates** — frontend refreshes as session grows

### Checkpoint improvements
- **Claude-initiated checkpoints** — when Claude enters plan mode ("should I proceed?"), auto-create a checkpoint via hooks. Two checkpoint types: user-created (manual) and Claude-created (automatic at plan boundaries)
- **Checkpoint UI in web** — create/view/rewind checkpoints from the web interface

### Tree features
- **Fork detection** — compare JSONL prefixes across sessions to detect which sessions were forked from which
- **Cross-session tree visualization** — render sessions as a tree (not flat list) showing parent-child fork relationships
- **Session comparison** — diff what happened on two different branches

### Product/distribution
- The viral loop: Claude Code user sees screenshot of tree view → runs `npx hex` → sees their own sessions → shares screenshot
- Target: "Built with Opus 4.6" Claude Code hackathon (Feb 10-16, $100k)
- Judged by Claude team — tool that enhances Claude Code (not replaces it) is the right angle

## Research context

This project was informed by 7+ user interviews identifying that AI coding tools create "speed without accountability." The core pain: session amnesia, context loss, inability to verify what happened. Pain layers: Memory (losing context), Verification (what did it do?), Calibration (was the approach right?), Flow (restarting from scratch). Hexdeck addresses Memory and Verification directly.

Claude Code already has the mechanics (forking, checkpoints, resume). Hexdeck is the visibility and navigation layer on top.
