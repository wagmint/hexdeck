# Pylon Room Architecture — High-Level Overview

## The Big Picture

```
Creator                    Room Server (you host)              Members

pylon init ──────────►    Room created
pylon invite ─────────►   Invite token generated ────────► pylon join <token>
                                                           choose repos to share
                          ┌──────────────────┐
  local pylon ──metadata──► Agent status      ◄──metadata── local pylon
                          │ File paths        │
                          │ Task summaries    │
                          │ Presence/heartbeat│
                          └────────┬─────────┘
                                   │
                          Dashboard (All View)
```

## Phase 1: Room Creation

The creator (tech lead, founder, whoever) sets up the shared environment.

```
$ pylon init

  Room name: acme-sprint
  Server: https://pylon.acme.dev  (your self-hosted relay)

  ✓ Room created: acme-sprint
  ✓ You are the admin
  ✓ Config saved to ~/.pylon/room.json

  Your operator profile:
    Name: Jake
    Color: #3B82F6 (auto-assigned)

  Invite teammates:
    pylon invite
```

This does two things:
- Registers the room on the relay server
- Creates the local config that identifies this person as an operator

## Phase 2: Inviting Members

```
$ pylon invite

  Room: acme-sprint

  Generate invite:
    ☑ Member (can view all, share their agents)
    ☐ Admin (can invite others, manage room)

  Expires: 7 days

  ✓ Invite token: pylon-join-xK9m2Qr

  Share with teammate:
    pylon join pylon-join-xK9m2Qr
```

Invite tokens are single-use or multi-use (admin chooses). Expiry prevents stale links floating around. Simple — no email integration, no OAuth, just a token. Startups move fast.

## Phase 3: Member Onboarding

The teammate on their machine:

```
$ pylon join pylon-join-xK9m2Qr

  Connecting to "acme-sprint" at pylon.acme.dev...

  ✓ Joined as member

  Your operator profile:
    Name: Andrew  (enter your name)
    Color: #F59E0B (auto-assigned, unique in room)

  Select repos to share with this room:

  Found agent sessions in:
    ☑ ~/work/acme-api
    ☑ ~/work/acme-frontend
    ☐ ~/personal/blog

  ✓ Sharing 2 repos with acme-sprint
  ✓ Config saved to ~/.pylon/room.json
```

From this point, their local Pylon starts pushing metadata for the selected repos. That's it — they're in.

## Phase 4: Day-to-Day

Once everyone's joined, each person's local Pylon does two things:

**Pushes** (to room server):
- Agent heartbeats (status, current task summary, files being touched)
- Collision-relevant data (file paths only, not contents)
- Plan task subjects (not full markdown)

**Pulls** (from room server):
- Other operators' agent metadata
- Cross-operator collision alerts
- Room-wide summary stats

The dashboard works in three modes:

| View | What you see | When you use it |
|------|-------------|----------------|
| **My View** | Only your agents, your feed, your workstreams. Default. | Normal work — "what are my agents doing?" |
| **All View** | Everyone's agents, operator-attributed (M2 colors). | Standup, coordination — "what's everyone working on?" |
| **[Name] View** | One teammate's agents in isolation. | Investigating — "what's Andrew's agent doing in auth/?" |

## Phase 5: Config File

Everything lives in one file:

```json
// ~/.pylon/room.json
{
  "room": "acme-sprint",
  "server": "https://pylon.acme.dev",
  "operatorId": "jake",
  "operatorName": "Jake",
  "color": "#3B82F6",
  "role": "admin",
  "sharedPaths": [
    "~/work/acme-api",
    "~/work/acme-frontend"
  ]
}
```

If this file doesn't exist, Pylon works exactly like today — fully local, single operator, no networking.

## What the Room Server Actually Stores

Minimal by design:

```
Room
├── name, created_at
├── members[]
│   ├── operatorId, name, color, role
│   └── last_seen (presence)
├── active_state (in-memory, not persisted)
│   ├── agent heartbeats per operator
│   ├── file paths being touched
│   └── task summaries
└── invite_tokens[]
```

No code. No conversations. No prompts. No diffs. If the server gets compromised, the attacker learns "Jake has 2 agents working on acme-api, one is editing `src/auth/login.ts`." That's it.

## Open Questions

1. **Room persistence**: Is a room permanent until deleted, or ephemeral (dies when everyone disconnects)? Leaning permanent — you `pylon init` once and use it for weeks/months.

2. **Multiple rooms**: Can one person be in multiple rooms? (Contractor working for two startups.) Probably yes — separate configs per room.

3. **Repo scoping changes**: Can you add/remove shared repos after joining? Probably yes — `pylon share add ~/work/new-service`.

4. **Offline behavior**: When someone disconnects, do their agents just show as "offline" in the room, or disappear entirely?

## Privacy Model

### Data Classification

| Data | Sensitivity | Shared with room? |
|------|------------|-------------------|
| Agent status (busy/idle) | Low | Yes |
| Current task description | Medium | Yes |
| Files being touched (paths) | Medium | Yes — collision detection |
| File contents / diffs | High | Never |
| Full conversation transcripts | Very high | Never |
| Prompts / instructions | Very high | Never |
| Plan task subjects | Medium | Yes |
| Plan full markdown | Medium-high | No |
| Error counts, token usage | Low | Yes |

### Repo Scoping

When joining a room, each member explicitly selects which repository paths to share. Only sessions within those paths have metadata pushed to the room server. All other sessions are invisible to the room — the server doesn't even know they exist.

```
Local Pylon (each dev)          Room Server (hosted)
┌─────────────────────┐         ┌──────────────────┐
│ Full agent state     │         │ Agent status      │
│ Code / diffs         │  ──►   │ File paths        │
│ Conversations        │ push   │ Task summaries    │
│ Prompts              │ thin   │ Presence          │
│ Plan markdown        │ meta   │ Collision detect  │
│ Error details        │         │ Room membership   │
└─────────────────────┘         └──────────────────┘
      stays local                 shared with room
```

## Research References

Architecture patterns drawn from:
- **Tailscale**: Thin coordination plane + peer-to-peer data plane separation
- **VS Code Live Share**: Host-guest model, data stays on host, relay only forwards encrypted metadata
- **Tuple**: Peer-to-peer sessions, cloud handles signaling only, zero server-side data storage
- **Slack Connect**: Shared surface with independent admin domains per org
- **Coder**: Template-driven onboarding, strong per-workspace isolation
- **Cursor Teams**: Privacy mode as org-wide policy toggle, metadata-only collaboration layer
- **Linear**: Domain-based auto-join + explicit invites, workspace > team hierarchy
