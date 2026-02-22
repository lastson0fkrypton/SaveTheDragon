# Deck Rework Summary (Current State)

## Status
This document is now a current-state summary. The earlier forest/desert/volcano deck-type planning has been superseded.

## Current Deck Model
- Canonical deck tiers are `easy`, `medium`, `hard`.
- Runtime deck IDs are:
  - `easy_encounter`, `easy_loot`
  - `medium_encounter`, `medium_loot`
  - `hard_encounter`, `hard_loot`
- Deck artifacts are generated to JSON and consumed by the server from `server/config/deck-definitions.json`.

## Generator/Simulator Split
- `deck-generator/` produces deterministic deck definitions (items, monsters, consumables, boss state).
- `simulator/` runs API-based simulation and GA auto-balancing against generator defaults.
- GA output includes baseline and best deck-definition artifacts.

## Key Balance Inputs (Now)
- `DEFAULT_HEALING_AMOUNT`
- `DEFAULT_BOSS_STATE`
- `DEFAULT_WEAPON_DAMAGE`
- `DEFAULT_ARMOR_PROTECTION`
- `DEFAULT_ITEM_CONSUMABLES`
- `DEFAULT_ITEM_VARIANT_MODIFIERS`
- `DEFAULT_MONSTER_TIER_BASE`
- `DEFAULT_MONSTER_CONSUMABLES`
- `DEFAULT_MONSTER_VARIANT_MODIFIERS`

## Guardrails in GA
- Strict tier ordering for major min/max values.
- Strict signed variant rules (weak/cracked negative, normal zero, strong/enchanted positive).
- Minimum deltas enforced for configured min/max pairs.
- Candidate parallelism supported via worker pool.

## Recent Schema Direction
- Monster catalog entries in `deck-generator` no longer need biome fields.
- Final boss stats are driven by `DEFAULT_BOSS_STATE` and can be tuned by GA.

## Notes
- If future balancing rules change, keep this summary aligned with `deck-generator/src/generateDeckDefinitions.ts` and `simulator/src/autoBalance.ts`.
