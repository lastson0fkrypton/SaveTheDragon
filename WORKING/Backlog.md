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
- **Status:** DONE
- **Notes:** Added immediate action buttons in loot modal for owner-only eligible loot: `Equip Now` for weapon/armor and `Use Now` for consumables, plus `Keep for Later` fallback. Added immediate game-state refresh after successful `equip`/`use-item` calls in client service so updates reflect in UI without page refresh. Type-safe UI gating prevents invalid actions. Validated with `npm run test -- --run` and `npm run build` in `client/`.

## BACKLOG-003
- **ID:** BACKLOG-003
- **Title:** Fix inventory/modal overflow so all items are reachable
- **Why:** Large inventories can exceed visible modal area, preventing users from scrolling to equip/use/close actions.
- **Acceptance Criteria:**
  - Inventory lists in relevant modals become scrollable when content exceeds viewport/modal size.
  - Close/action controls remain accessible regardless of inventory length.
  - Works for item, weapon, and armor modals on common screen sizes.
- **Status:** DONE
- **Notes:** Updated `ItemModal`, `WeaponModal`, and `ArmorModal` to use a constrained modal layout with a dedicated scroll area for inventory cards and a persistent bottom action row for close controls. Added shared CSS (`inventory-modal-window`, `inventory-scroll-area`, `inventory-modal-actions`) so large inventories scroll within modal height and action controls remain accessible on shorter viewports. Validated with `npm run test -- --run` and `npm run build` in `client/`.

## BACKLOG-004
- **ID:** BACKLOG-004
- **Title:** Expand castle danger zone and set volcano encounters to 100%
- **Why:** Castle-adjacent area should feel high-risk and clearly distinct from safer zones.
- **Acceptance Criteria:**
  - Volcano biome area around castle is increased (distance/radius larger than current).
  - Volcano encounter rate is set to 1.0 (100%).
  - Generation remains valid within map bounds and produces stable maps.
- **Status:** DONE
- **Notes:** Increased castle-adjacent volcano danger zone from radius 1 to radius 2 in biome generation as a true circular radius (bounds-checked), and set `volcano` encounter chance to `1.0` (100%). Added/updated biome generation test coverage to assert circular radius constraints and expanded distance-2 volcano presence around castle. Validated with `npm run test` and `npm run build` in `server/`.

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
- **Status:** DONE
- **Notes:** Reworked balancing to a curved progression model. Monsters now scale by biome tier with larger non-linear jumps (plains/forest early, desert mid, cave/volcano late) and deterministic weak/normal/strong variant deltas in `server/constants/monsters.ts`, while preserving IDs/names/biomes/images. Items were rebalanced in `server/constants/items.ts` using tier baselines for weapon/armor attack/defense and chance values, plus tuned consumables (`small/medium/large_potion` heal `4/7/11`), while preserving IDs/names/biomes/images. Removed legacy stat dependence from active catalogs so exported stats are model-driven by tier config rather than embedded per-entry legacy values. Added test coverage in `server/tests/monsterBalance.test.ts` and `server/tests/itemBalance.test.ts`. Updated client chance bars to support dynamic percentages via CSS variable fill (no more hard-coded 50/70/90-only rendering) in `client/src/index.css` and modal/panel components. Validated with `npm run test` and `npm run build` in both `server/` and `client/`.

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
- **Status:** DONE
- **Notes:** Implemented server-authoritative shared raid boss state for `Evil Princess` with persistent health in game state (`raidBoss.currentHealth`) and completion state (`gameCompletion`) in `server/types.ts` + `server/services/gameService.ts` + `server/services/battleService.ts`. Castle tile now triggers boss encounters while undefeated; boss health persists across encounters/runs/losses and no full reset occurs between fights. Defeating the boss marks game complete with winner metadata and completion timestamp, emits completion battle log/recent action, and blocks further turn/battle progression server-side (`roll`, `move`, `attack`, `run`, `return-to-town`). Added client state typing and lightweight completion visibility in overlays (`GamePanel`, `DicePanel`) so all players receive completion state from API responses. Validated with `npm run test` and `npm run build` in both `server/` and `client/`.

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

## BACKLOG-013
- **ID:** BACKLOG-013
- **Title:** Rework movement click flow with destination confirmation UX
- **Why:** Current move flow requires precision clicking and immediate commit, which feels difficult and error-prone.
- **Acceptance Criteria:**
  - On roll, camera recenters on active player.
  - Clicking a valid square selects it (does not immediately move).
  - Selected square is visually highlighted with a red border.
  - An arrow is drawn from player position to selected destination.
  - During move selection phase, roll UI becomes an `End Turn` action with tick icon (`/icons/check.png`).
  - Clicking `End Turn` commits movement to the selected square.
- **Status:** DONE
- **Notes:** Implemented click-to-select movement in `GameBoard` (no immediate move), red border highlight, player-to-target arrow render, and camera recenter when roll begins for active player. Added `selectedMove` state to `AppState` and `End Turn` confirmation flow in `DicePanel` with `/icons/check.png`. Validated via `npm run build` and `npm run test` in client.

## BACKLOG-014
- **ID:** BACKLOG-014
- **Title:** Build AI-driven gameplay simulation harness for concurrency and balance feedback
- **Why:** Automated, repeatable game runs are needed to stress multiplayer concurrency, collect large gameplay datasets, and create a feedback loop for balancing changes.
- **Acceptance Criteria:**
  - An **in-process server-side simulation runner** can execute full game loops quickly (create/join/roll/move/battle/loot/equip/use/turn progression), suitable for repeated AI-guided balancing runs.
  - Runner supports parallel execution of many games/players to test concurrency and race-condition behavior.
  - Runner outputs structured per-game logs and aggregate summaries and can return machine-readable results to AI agent workflows.
  - Runner supports configurable player behavior profiles (e.g., risk-averse, aggressive, completionist) to emulate different player expectations.
  - Runner tracks balancing metrics including at minimum: battles won/lost, turns between encounters, encounter count, win streaks, loss streaks, per-game outcome, and turns-to-win/lose.
  - Runner can compare balance revisions by running baseline vs candidate batches and producing simple scorecards (survival rate, turn count, win/loss distribution, biome progression cadence).
  - A max-turn cap is enforced per game so non-beatable/broken states are detected and reported explicitly.
  - Assumes final-boss win condition from `BACKLOG-007` exists before full rollout; simulation reports beatable-rate against this condition.
  - Target balancing guidance is measurable and reportable (initial target: approximate win/loss ratio near 2:1).
  - Simulation config supports at minimum: `seed`, `runs`, `parallelism`, `playersPerGame`, `turnCap`, behavior profile weights, and output/artifact settings.
  - Batch output includes machine-readable summary fields for AI workflows: `winRate`, `lossRate`, `timeoutRate`, `winLossRatio`, `beatableRate`, and profile-level breakdowns.
  - Batch output includes pacing and quality signals: `encounters`, `avgTurnsBetweenEncounters`, `turnsToOutcome` percentiles, early-loss frequency, and timeout frequency.
  - Runner produces explicit regression/fail signals when beatable rate drops, timeout rate exceeds threshold, or ratio moves outside target band.
  - Tooling and usage are documented so future AI prompt sessions can run simulations after logic/constant changes.
- **Status:** TODO
- **Notes:** Agreed direction: in-process server-side test/harness (fast execution) with AI-consumable summary output for iterative auto-balancing. Include child-friendly difficulty validation heuristics for target demographic (10-year-olds), plus explicit fail signals when beatable condition regresses.

  Planned implementation blueprint (for later):
  - **Runner shape:** Add a server-side simulation entrypoint (test/tool) callable via npm script, deterministic by `seed`.
  - **Execution model:** Run many games quickly in-process, with configurable parallelism and per-game `turnCap`.
  - **Per-game metrics:** `battlesWon`, `battlesLost`, `encounterCount`, `avgTurnsBetweenEncounters`, `longestWinStreak`, `longestLoseStreak`, `turnsPlayed`, `outcome` (`win|loss|timeout|aborted`).
  - **Batch scorecard:** Aggregate `win/loss/timeout` rates, `winLossRatio` (target near `2:1`), beatable rate, profile breakdowns, and outcome pacing percentiles.
  - **Balancing loop:** Support baseline-vs-candidate runs and emit recommendation/regression payloads for AI-driven tuning iterations.

## BACKLOG-015
- **ID:** BACKLOG-015
- **Title:** Handle player quit/idle absence with turn skip and auto-return on activity
- **Why:** Multiplayer sessions should continue smoothly when a player leaves or becomes inactive, without permanently blocking turn progression.
- **Acceptance Criteria:**
  - A player can explicitly quit a game and is marked `absent` in server-authoritative game state.
  - A player with no API activity for 30 seconds is automatically marked `absent`.
  - Turn progression always advances to the next non-absent player.
  - Absent players are skipped for roll/move/battle/turn prompts while absent.
  - If all players are absent, server behavior is defined and safe (no infinite loops/crashes).
  - Any subsequent valid API request from an absent player marks them active again and re-enables normal participation from their next eligible turn.
  - Presence/absence state changes are reflected consistently in API responses used by the client.
- **Status:** TODO
- **Notes:** Implement as server-side authoritative presence tracking with last-activity timestamps and a shared helper used by turn-advance logic.

## BACKLOG-016
- **ID:** BACKLOG-016
- **Title:** Expand admin live-ops controls and apply related gameplay/UI hotfixes
- **Why:** Fast manual testing and balancing iterations need stronger admin controls and a few targeted quality fixes discovered during playtesting.
- **Acceptance Criteria:**
  - Admin portal provides per-active-game controls to:
    - Kick individual players.
    - Grant items to individual players from full item catalog (including generated tier/variant items).
    - Mark games as `Prevent expiry` so inactivity cleanup does not delete them.
  - Admin actions show success/error feedback in UI.
  - Battle card health display scales for large HP values.
  - Weapon balance floor ensures random weapons are never worse than starter fist baseline.
  - Consumable use removes one instance when multiple copies of same item are held.
  - Player list displays compact Health/Attack/Defense icon+value badges.
- **Status:** DONE
- **Notes:** Implemented server admin endpoints for kick, give-item, item-catalog fetch, and prevent-expiry toggle; cleanup loop now respects per-game prevent-expiry flag. Added admin UI consoles per game with player controls plus action toasts. Updated kick button label/layout to `Kick`. Battle modal health switched to numeric current HP display for both sides. Item rebalance updated to enforce random weapon minimums (`attack >= 2`, `attackChance >= 0.5`) and added regression coverage in `server/tests/itemBalance.test.ts`. Fixed stacked consumable bug in `server/services/playerService.ts` so one copy is consumed per use. Updated player list stats UI to show Health/Attack/Defense badges with final alignment of attack/defense left and health right-emphasized.

---

## Working Rule
When asking Copilot to execute work, reference the backlog ID directly (example: "Do BACKLOG-003").
