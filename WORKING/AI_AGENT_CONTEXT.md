# AI Agent Context / Handoff

## Purpose
This file is a persistent handoff so any future Copilot session can quickly resume work with the same understanding.

## Project Snapshot
- **Project:** SaveTheDragon
- **Type:** Multiplayer turn-based, grid-based web game
- **Server:** Node.js + Express + SQLite
- **Client:** React + TypeScript + Vite + MobX
- **State Model:** Server-authoritative game state, client polls `/api/games/:gameId/state` periodically

## Current Architecture (High-Level)
- **Server routes:** game, battle, player, admin route modules under `server/routes/`
- **Persistence:** raw SQL directly in route handlers via `server/db.js`
- **Game data/constants:** items, monsters, characters, biome rates in `server/constants/`
- **Client pages:** home, game, admin under `client/src/pages/`
- **Client game UI:** board + overlays + modals under `client/src/components/`
- **Backlog source of truth:** `WORKING/Backlog.md`

## Known Product State
- Core loop exists: create/join game, roll, move, encounter, battle, loot, equip/use, turn progression.
- Quest UI exists but is mostly placeholder (not fully implemented gameplay system yet).
- Title/theme says “Save the Dragon”, but explicit win condition is not yet fully wired (planned in BACKLOG-007).

## Backlog Status
Backlog items are maintained in `WORKING/Backlog.md`.
Latest known additions include:
- BACKLOG-001 through BACKLOG-012
- BACKLOG-002 includes immediate equip **and** immediate use request

## Working Conventions for Future AI Sessions
1. Read `WORKING/Backlog.md` first.
2. Execute one backlog item at a time by ID.
3. Update that item status (`TODO` -> `IN-PROGRESS` -> `DONE/BLOCKED`) as work progresses.
4. Keep changes focused to the requested backlog scope.
5. Validate with targeted run/build checks where possible.

## Suggested "Start Tomorrow" Prompt
Use this as your first message in a new chat:

"Please read `WORKING/AI_AGENT_CONTEXT.md` and `WORKING/Backlog.md`, then continue with BACKLOG-XXX. First set BACKLOG-XXX to IN-PROGRESS, implement it end-to-end, run relevant validation, and update backlog notes/status."

Replace `BACKLOG-XXX` with the item you want next.

## Optional Fast Resume Prompt (if unsure what to do next)
"Please read `WORKING/AI_AGENT_CONTEXT.md` and `WORKING/Backlog.md`, then recommend the best next backlog item to tackle with lowest risk/highest value, and start it."

## Notes for Next Agent
- Keep UX minimal unless backlog item explicitly asks for richer UX.
- Preserve server-authoritative rules; avoid client-trusting game logic.
- Prefer incremental changes and verify behavior after each item.
