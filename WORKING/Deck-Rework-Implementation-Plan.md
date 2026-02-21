# Deck Rework Implementation Plan

## Scope
This plan converts deck behavior from random composition to explicit, physically buildable decks while preserving existing game flow and simulation capabilities.

## Phase 0 - Completed
- Captured product rules and constraints in `WORKING/Deck-Rework-Summary.md`.
- Confirmed key current-state gaps:
  - runtime deck generation is random-by-composition
  - 5 biome decks instead of 3 shared deck types
  - no explicit card-list JSON deck artifacts

## Phase 1 - Start Now (Foundation, low-risk)
1. Add a deck-type domain model (`forest`, `desert`, `volcano`) with biome mapping:
   - plains/forest -> forest
   - desert -> desert
   - cave/volcano -> volcano
2. Update runtime deck state creation so mapped biomes share the same runtime deck instance.
   - This immediately aligns with tabletop expectation that plains+forest and cave+volcano draw from shared physical decks.
3. Keep existing draw/discard/rebuild behavior untouched.
4. Keep current card generation (composition-based) as temporary fallback until explicit deck JSON is wired.

### Phase 1 Acceptance
- Encounter/loot draw for plains and forest affects the same deck state.
- Encounter/loot draw for cave and volcano affects the same deck state.
- Existing API behavior and combat flow remain functional.

## Phase 2 - Explicit Deck Definitions
1. Add new config schema for explicit deck files:
   - 6 decks total: forest/desert/volcano x encounter/loot
2. Add validator for:
   - required decks exist
   - required consumables exist
   - no unknown IDs
3. Load explicit deck file(s) at startup with fallback to generated composition if missing.

### Phase 2 Acceptance
- Runtime can fully build from explicit deck JSON.
- Invalid deck files fail fast with actionable error messages.

## Phase 3 - Rule Enforcement
1. Enforce encounter requirements:
   - weak/normal/strong variant for each monster in deck type.
2. Enforce loot requirements:
   - one of each item per deck type baseline.
3. Add chest encounter card support with same-type loot draw.

### Phase 3 Acceptance
- Validation enforces your deck-building rules automatically.
- Chest card is playable and uses matching loot deck.

## Phase 4 - Simulation Deck Generator
1. Add simplified generator config to produce explicit deck JSON:
   - consumable counts
   - extra-heart counts
   - chest counts
   - potion heal values
   - per-deck-type item min/max stat ranges
2. Simulation uses generated explicit decks as input.
3. Treat min/max stat ranges as simulation-only knobs.
4. Bake final chosen stats into output deck files after simulation completes.

### Phase 4 Acceptance
- Simulation runs against deterministic deck files.
- Fitness evaluation can optimize generator parameters.
- Final deck JSON is immutable for runtime play (no further stat scaling applied at draw time).

## Phase 5 - Optional Combat Simplification Mode
1. Add tabletop-friendly combat mode toggle.
2. Implement single-roll opposed mode (recommended) while retaining current mode for compatibility.

## Phase 6 - Legacy Logic Removal
1. After explicit deck JSON generation is stable and adopted, remove legacy encounter-rate / percentage-based deck generation paths.
2. Remove composition-driven random deck construction from active runtime paths.
3. Promote simplified dice-roll battle mode to primary mode (or only mode, based on rollout decision).

### Phase 6 Acceptance
- Runtime deck behavior is driven only by explicit deck JSON artifacts.
- Legacy percentage/config pathways are retired from primary gameplay flow.
- Battle resolution is simplified for tabletop-friendly execution.

## Notes
- We will keep changes incremental and test after each phase.
- Existing balance configs remain in use until replaced by explicit deck config in later phase(s).
- Item min/max ranges are optimization inputs only, not runtime modifiers once final decks are generated.

## Implementation Status (2026-02-21)
- ✅ Added deck-type domain mapping in config:
   - `forest`, `desert`, `volcano`
   - plains/forest -> forest, cave/volcano -> volcano
- ✅ Updated runtime deck creation to share deck instances by deck type.
- ✅ Updated deck rebuild logic to use deck-type template biomes consistently.
- ✅ Verified with `npm test` and `npm run build` in `server`.
- ✅ Started Phase 2 (explicit deck definitions):
   - Added optional explicit deck config loader + validator.
   - Wired deck runtime to consume explicit definitions when present, with fallback to composition generation.
   - Added automated tests for explicit deck config validation.
- ✅ Continued implementation:
   - Added encounter chest card support in config + runtime + game flow handling.
   - Added deterministic deck-definition generator script and npm command to produce full JSON deck artifacts.
   - Generated `config/deck-definitions.json` with baked card stats sourced from current balanced catalogs.
   - Refactored deck-definition schema to keep consumables in per-deck count maps (`consumables`) instead of mixing them in `cards`.
   - Runtime now expands `consumables` counts into shuffled consumable/extra-heart cards for each deck.
   - Removed composition-based runtime fallback; explicit deck definitions are now the required runtime source.

### Files changed in this pass
- `server/config/biomeDeckConfig.ts`
- `server/services/biomeDeckService.ts`
- `server/config/deckDefinitionsConfig.ts`
- `server/serverApp.ts`
- `server/tests/deckDefinitionsConfig.test.ts`
- `WORKING/Deck-Rework-Implementation-Plan.md`
