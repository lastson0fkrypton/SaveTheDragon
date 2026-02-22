# Deck Rework Implementation Plan (Archived)

## Status
This plan is archived. Most items in the old phased plan were completed and then evolved further.

## What Is True Now
- Deck generation is a standalone project: `deck-generator/`.
- Simulation/GA is a standalone project: `simulator/`.
- Server runtime consumes generated deck definitions from `server/config/deck-definitions.json`.
- Active tiers are `easy`, `medium`, `hard` (not `forest/desert/volcano` deck IDs).

## Implemented Highlights
- Deterministic deck definition generation with explicit cards and consumable counts.
- Simulation harness running through real API endpoints.
- GA auto-balance over concrete generator defaults with artifact outputs.
- Candidate parallel evaluation with isolation safeguards.
- Additional GA guardrails for ordering/sign/range-delta constraints.
- Boss tuning support via `DEFAULT_BOSS_STATE`.
- Monster catalog cleanup removing generator-side biome dependency.

## Where to Look Instead
- Current behavior summary: `WORKING/Deck-Rework-Summary.md`
- Backlog source of truth: `WORKING/Backlog.md`
- Runtime and data contracts:
  - `deck-generator/src/generateDeckDefinitions.ts`
  - `simulator/src/autoBalance.ts`
  - `server/config/deckDefinitionsConfig.ts`
