# Deck Rework Summary (Tabletop + Simulation)

## Goal
Make decks physically buildable in the real world while keeping simulation-driven balancing.

## Requirement Summary
1. **Three biome deck types only**
   - `forest` (used for plains + forest)
   - `desert` (used for desert)
   - `volcano` (used for cave + volcano)

2. **Two decks per type**
   - `*_encounter`
   - `*_loot`

3. **Encounter deck monster constraint**
   - Must include **weak + normal + strong** card for **every monster in that deck type**.

4. **Loot deck item constraint**
   - Must include **one of each item** from that deck type.

5. **Consumables constraint**
   - Variable counts allowed, but deck system must include cards for:
   - `return_to_town`, `extra_heart`, `small_potion`, `medium_potion`, `large_potion`, `full_potion`

6. **Combat usability concern**
   - Current attack/defense points + attack/defense chance can be cumbersome for human play.
   - Need optional simplified resolution.

7. **Item uniqueness/scaling**
   - Item stats should scale between adjustable min/max values per deck type **during simulation/generation only**.
   - After simulation chooses the best setup, final deck JSON should have **baked (fixed) item stats** for real gameplay.

8. **Discard/recycle behavior**
   - Drawn cards go to deck-specific discard.
   - When draw pile is empty, reshuffle discard into new draw pile.

9. **Chest cards in encounter deck**
   - Encounter deck can include `chest` cards.
   - Chest gives random loot card from the same deck type.

10. **Deck output format**
   - Full JSON deck files with complete card lists.
   - IDs sourced from `constants/items.ts` and `constants/monsters.ts`.

11. **Post-migration cleanup**
   - Once full deck JSON generation is adopted, we can remove legacy rate/percentage-driven deck-generation logic (encounter/item drop composition and weighted random generation paths).
   - After that migration, battle flow can move to the simplified dice-roll style rules for tabletop usability.

---

## Feedback on Current Implementation

### What already matches
- Discard pile reshuffle behavior already exists in runtime deck logic.
- Consumable healing values are already externally tunable through game balance config.

### Main mismatch to your target
- Current deck config is **composition-by-count** (`monster: N`, `item: N`, etc.), not explicit card list definitions.
- Cards are generated at runtime with random picks from pools, so real-world deterministic deck construction is not possible.
- Current model has **five biome runtime decks** (`plains`, `forest`, `desert`, `cave`, `volcano`) instead of your requested three deck types.

---

## Recommended Rework (Minimal/Practical)

### 1) Introduce explicit deck definitions
Create a canonical deck-definition JSON containing six decks:
- `forest_encounter`, `forest_loot`
- `desert_encounter`, `desert_loot`
- `volcano_encounter`, `volcano_loot`

### 2) Add biome-to-deck-type mapping
- plains/forest -> forest
- desert -> desert
- cave/volcano -> volcano

### 3) Keep runtime behavior, change deck source
Keep draw/discard/rebuild flow, but build runtime piles from explicit deck JSON instead of composition counts.

### 4) Add chest card handling
- New encounter card kind: `chest`
- On draw: grant one random loot card from matching deck type (and that loot draw itself follows discard rules).

### 5) Add simulation-friendly generator config
Use a simplified config that generates the explicit deck files before sim run:
- consumable counts per encounter/loot deck
- extra heart counts per deck
- chest counts per encounter deck
- potion heal values
- item stat min/max ranges per deck type and item type
- Note: these min/max ranges are **sim-only tuning inputs**; generated output decks are fixed-value artifacts.

---

## Suggested Deck JSON Shape

```json
{
  "deck": "forest_loot",
  "cards": [
    {
      "kind": "item",
      "id": "rusty_spoon",
      "name": "Rusty Spoon",
      "type": "weapon",
      "attack": 2,
      "attackChance": 0.5153
    },
    {
      "kind": "item",
      "id": "rubber_bracelet",
      "name": "Rubber Bracelet",
      "type": "armor",
      "defense": 2,
      "defenseChance": 0.5153
    },
    {
      "kind": "consumable",
      "id": "small_potion",
      "name": "Small Health Potion",
      "heal": 4
    }
  ]
}
```

### Encounter card variants
```json
{ "kind": "monster", "id": "weak_trollkin", "baseMonsterId": "trollkin", "variant": "weak" }
{ "kind": "monster", "id": "trollkin", "baseMonsterId": "trollkin", "variant": "normal" }
{ "kind": "monster", "id": "strong_trollkin", "baseMonsterId": "trollkin", "variant": "strong" }
{ "kind": "chest", "id": "forest_chest" }
```

---

## Combat Simplification Options (for tabletop)

### Option A: Single-roll opposed test (recommended)
- Attacker roll (d6) + attack.
- Defender roll (d6) + defense.
- Hit if attacker total > defender total.
- Remove attackChance/defenseChance from tabletop mode.

### Option B: Keep chance, remove defense chance
- Attack succeeds on attack chance roll.
- Defense is flat mitigation (no defense chance roll).
- Keeps some probability flavor with fewer steps.

### Option C: Tiered target number
- Convert chance to target number once (e.g., attackChance 0.5 => 4+ on d6).
- Use only one chance check per action.

---

## Validation Rules to Add
- Every deck type has both encounter and loot decks.
- Encounter deck includes weak/normal/strong for every monster in that deck type.
- Loot deck includes all biome items exactly once before optional duplicates.
- Required consumable card IDs exist in the deck set.
- No unknown IDs (must resolve against constants catalogs).

---

## Proposed Next Implementation Steps
1. Add new config schema and loader for explicit deck JSON files.
2. Add deck-type mapper (biome -> forest/desert/volcano).
3. Update biome deck runtime service to consume explicit deck definitions.
4. Add chest encounter handling.
5. Add generator config for simulation -> deck JSON output.
6. Add tests for deck validation + discard/reshuffle + chest behavior.
