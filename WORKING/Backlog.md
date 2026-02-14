# Save The Dragon Backlog

Use this file as the single source of truth for planned work.  
Execution pattern: pick the next `TODO` item, complete it, validate it, then update `Status` + `Notes`.

## Status Legend
- `TODO` = not started
- `IN-PROGRESS` = currently being worked on
- `BLOCKED` = cannot proceed without input/decision
- `DONE` = completed and validated

---

## BACKLOG-001
- **ID:** BACKLOG-001
- **Title:** Refactor server architecture: isolate game logic and data access
- **Why:** Game rules are spread across route handlers, making behavior hard to reason about and maintain. SQL is mixed with route/controller logic.
- **Acceptance Criteria:**
  - API route files primarily handle HTTP concerns (`req/res`, validation, status codes).
  - Core game logic is moved into a dedicated game-logic layer (e.g., service/helper modules) and reused by routes.
  - Raw SQL calls are abstracted behind a repository/data-access layer.
  - Existing game behavior remains functionally equivalent after refactor.
  - File/module boundaries are documented in as README updates.
- **Status:** DONE
- **Notes:** Completed refactor of game, battle, player, and admin flows to service + repository layers. Added `server/repositories/dbClient.js`, `server/repositories/gameRepository.js`, and service modules under `server/services/`. Routes are now thin controllers with centralized error mapping. Updated README with architecture boundaries. Server startup validated via `npm run start`.

## BACKLOG-002
- **ID:** BACKLOG-002
- **Title:** Prompt immediate equip/use option when item is found
- **Why:** When a player receives loot, the common desired action is to equip gear or use a consumable right away; current flow adds friction.
- **Acceptance Criteria:**
  - After receiving eligible loot (weapon/armor), player sees an immediate equip choice in the loot interaction.
  - After receiving eligible consumable loot (`item` type), player sees an immediate use choice in the loot interaction.
  - Choosing equip updates equipped item server-side and reflects in UI without page refresh.
  - Choosing use applies item effects server-side and reflects in UI without page refresh.
  - Choosing not to equip keeps current behavior (item remains in inventory).
  - Choosing not to use keeps current behavior (item remains in inventory).
  - Loot actions are type-safe (no equip for non-equippables, no use for non-consumables).
- **Status:** TODO
- **Notes:** Keep UX minimal and consistent with existing modal style.

## BACKLOG-003
- **ID:** BACKLOG-003
- **Title:** Fix inventory/modal overflow so all items are reachable
- **Why:** Large inventories can exceed visible modal area, preventing users from scrolling to equip/use/close actions.
- **Acceptance Criteria:**
  - Inventory lists in relevant modals become scrollable when content exceeds viewport/modal size.
  - Close/action controls remain accessible regardless of inventory length.
  - Works for item, weapon, and armor modals on common screen sizes.
- **Status:** TODO
- **Notes:** Verify in both desktop and smaller-height window scenarios.

## BACKLOG-004
- **ID:** BACKLOG-004
- **Title:** Expand castle danger zone and set volcano encounters to 100%
- **Why:** Castle-adjacent area should feel high-risk and clearly distinct from safer zones.
- **Acceptance Criteria:**
  - Volcano biome area around castle is increased (distance/radius larger than current).
  - Volcano encounter rate is set to 1.0 (100%).
  - Generation remains valid within map bounds and produces stable maps.
- **Status:** TODO
- **Notes:** Confirm impact on spawn fairness and pathing from towns.

## BACKLOG-005
- **ID:** BACKLOG-005
- **Title:** Rebalance monster progression by biome difficulty tiers
- **Why:** Desired progression is early game in plains/forest, mid-game in desert, end-game in cave/volcano.
- **Acceptance Criteria:**
  - Monster health/attack/chance tuning enforces clear progression by biome.
  - Plains/forest monsters are survivable with starter/early gear.
  - Desert monsters are meaningfully harder and reward progression.
  - Cave/volcano monsters are strongest and unsuitable for early players.
  - Balance pass documented with rationale (short notes on stat ranges/tiering).
- **Status:** TODO
- **Notes:** Consider pairing monster rebalance with item stat tiers if needed.

## BACKLOG-006
- **ID:** BACKLOG-006
- **Title:** Implement town-driven quest system with map prompts and objectives
- **Why:** The game needs explicit objective loops beyond roaming combat and loot.
- **Acceptance Criteria:**
  - Random towns can host available quests, visually indicated on map/UI.
  - Walking over a quest town prompts player to accept/start a quest.
  - Quest tracking and completion status persist in game state.
  - Initial quest types implemented:
    - Kill a monster from biome X.
    - Kill 3 weak/regular/strong monsters in a row.
    - Kill 3 venom monsters (scorpion/snake/spider) and return to hospital.
    - Kill X skeletons and return to church.
    - Rescue a villager from biome X and return.
    - Deliver parcel from town A to town B.
  - Return/turn-in conditions are validated server-side.
  - Quest log UI displays active/completed quests and progress.
- **Status:** TODO
- **Notes:** Define quest state model first (assignment, progress counters, objective targets, completion rewards).

## BACKLOG-007
- **ID:** BACKLOG-007
- **Title:** Add shared raid-style win condition: defeat the Evil Princess
- **Why:** The game needs a clear end-goal where players can coordinate across turns to defeat a persistent final boss.
- **Acceptance Criteria:**
  - A unique special monster (`Evil Princess`) is added with very high stats.
  - This boss uses persistent health at game scope (not per-battle reset).
  - Boss health decreases after each battle and does not fully heal between encounters.
  - Multiple players can engage in sequence over time and contribute to total damage.
  - Win condition triggers when boss health reaches 0, with game state updated and communicated to all players.
  - Post-win behavior is defined (e.g., game complete state and disabled further turns/battles or explicit restart flow).
- **Status:** TODO
- **Notes:** Implement boss state server-side as authoritative shared game data.

## BACKLOG-008
- **ID:** BACKLOG-008
- **Title:** Refactor UI for mobile-friendly gameplay
- **Why:** Current UI is desktop-first and difficult to use on phones.
- **Acceptance Criteria:**
  - Core flows (create/join, move, roll, battle, inventory, equip/use) are usable on common mobile viewport sizes.
  - Layout scales responsively without overlap/clipping of critical controls.
  - Touch interaction is supported for board panning/selection and modal actions.
  - Text and controls meet basic tap-target/readability expectations.
- **Status:** TODO
- **Notes:** Start with GamePage overlays/modals and board interaction ergonomics.

## BACKLOG-009
- **ID:** BACKLOG-009
- **Title:** Add battle modal hit/attack animations
- **Why:** Battle outcomes feel static; simple visual feedback will increase clarity and excitement.
- **Acceptance Criteria:**
  - Attacking character briefly shakes/lunges when attack action resolves.
  - Defending/target character flashes red when taking damage.
  - Animations trigger based on battle event outcomes (hit/miss/damage) and do not block controls.
  - Effects remain lightweight and performant.
- **Status:** TODO
- **Notes:** Keep animation durations short and readable.

## BACKLOG-010
- **ID:** BACKLOG-010
- **Title:** Animate character movement between grid positions
- **Why:** Current movement snaps instantly; interpolation would improve visual quality while preserving server authority.
- **Acceptance Criteria:**
  - Character tokens animate from previous position to new position instead of instant teleport.
  - Animation is purely client-side interpolation using known previous/current state.
  - Logical game state remains authoritative from server values (no gameplay desync introduced).
  - Multiple players moving across turns render smoothly.
- **Status:** TODO
- **Notes:** Track previous positions per player in client state for interpolation.

## BACKLOG-011
- **ID:** BACKLOG-011
- **Title:** Expand battle log language variety
- **Why:** Repetitive phrasing reduces immersion; richer narration improves moment-to-moment gameplay feel.
- **Acceptance Criteria:**
  - Add at least 10 varied message templates across key combat events (attack, hit, miss, defend/block, damage taken, low health, defeat).
  - Templates support dynamic values (player/monster names, damage numbers, outcomes).
  - Logs remain clear and concise while more expressive.
  - Existing battle state logic remains unchanged except messaging generation.
- **Status:** TODO
- **Notes:** Centralize message generation in a helper to keep consistency.

## BACKLOG-012
- **ID:** BACKLOG-012
- **Title:** Add music, SFX, and battle log text-to-speech
- **Why:** Audio feedback can significantly improve immersion and convey game state changes.
- **Acceptance Criteria:**
  - Add SFX for key actions (at minimum movement and combat actions).
  - Add looping background music selected by current biome.
  - Add battle music selected by current battle biome.
  - Add optional text-to-speech playback for battle log lines using Web Speech API voices.
  - Provide user controls for volume/mute and TTS enable/disable.
  - Audio transitions are stable (no overlapping/stacking leaks during state changes).
- **Status:** TODO
- **Notes:** Include safe fallbacks when browser audio/TTS APIs are unavailable.

---

## Working Rule
When asking Copilot to execute work, reference the backlog ID directly (example: "Do BACKLOG-003").
