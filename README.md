# Save the Dragon!
![{611A21BA-B523-46FA-A264-4339864F43BA}](https://github.com/user-attachments/assets/bc0624d8-5311-4b4e-a763-3ef91915b7a3)


Save the Dragon! is a turn-based, grid-based multiplayer board game implemented as a web app. Players join a game, roll dice to move their characters, and compete or cooperate to save the dragon. Each player is represented by a unique character picture and can move around the board based on dice rolls. The game state is managed on a Node.js/Express server with SQLite for persistence.

## Features
- Multiplayer support: Join or create games with friends.
- Turn-based movement on a customizable grid.
- Dice rolling and valid move highlighting.
- Player character selection.
- Admin panel for managing games.
- Shared raid-boss win condition (`Evil Princess`) with server-authoritative completion state.
- Dynamic balance model for monsters/items by biome tier and variants.

## Prerequisites
- Node.js (v16 or newer recommended)
- npm (comes with Node.js)

## Setup & Run

1. **Start the server:**
   ```sh
   cd server
   npm install
   npm run start
   ```
   The server will start on http://localhost:3000 and auto-restart when server `.ts` files change.

   For a production-style run (compiled output):
   ```sh
   npm run build
   npm run start:prod
   ```

2. **Build and Run the client:**
   ```sh
   cd client
   npm install
   npm run dev
   ```

3. **Open the game:**
   Visit [http://localhost:5173/](http://localhost:5173/) in your browser.

## Admin Panel
- Access the admin panel via the "Admin" link on the home screen.
- The default admin password is `superman` (see `server/services/adminService.ts`).
- Admin console supports:
   - Deleting games
   - Kicking players from a game
   - Granting any item (including generated tiers/variants)
   - Marking a game as `Prevent expiry` so inactivity cleanup skips it

## Notes
- Game state and player data are stored in `server/database.sqlite`.
- By default, the server cleans up inactive games after 60 seconds of inactivity.
- Games flagged `Prevent expiry` in admin are excluded from inactivity cleanup.

## Simulation & Auto-Balancing (BACKLOG-014)

This project includes two balancing tools under `server/simulation/`:

- **Simulation runner (`simulate`)**
   - Use this when you already have a tuning idea and want to evaluate it.
   - It runs many games with a fixed config and optional candidate overrides.
   - Best for: quick validation, A/B comparisons, troubleshooting balance regressions.

- **Genetic auto-balancer (`autobalance`)**
   - Use this when you want the system to search for stronger candidate overrides automatically.
   - It evaluates multiple candidate genomes across generations and returns the best candidate + artifacts.
   - Best for: exploring large parameter spaces and finding good starting points for manual tuning.

### Important metric semantics

- `winRate`, `lossRate`, `timeoutRate`, `abortedRate` are **outcome buckets** and should sum to ~100%.
- `beatableRate` is **not** an outcome bucket. It means “the game instance was considered beatable under the current rule/threshold logic,” so it is independent and does not need to sum with outcome rates.

### Quick start

From repo root:

```sh
cd server
npm install
```

### Windows PowerShell quick start (copy/paste)

```powershell
Set-Location server
npm install

# Fast transient simulation mode (recommended)
$env:SAVE_THE_DRAGON_DB_CLIENT='in-memory'

# 1) Baseline simulation run
npm run simulate -- --seed=baseline --runName=simulate-baseline --runs=100 --parallelism=6 --turnCap=120 --artifactDir=simulation-output --writeTextReport=true --textReportFileName=baseline-report.txt

# 2) Candidate validation run
$candidate='{"item":{"dropRates":{"healthItemMultiplier":2.0,"extraHeartMultiplier":2.5}}}'
npm run simulate -- --seed=candidate-1 --runName=simulate-candidate-1 --runs=100 --parallelism=6 --turnCap=120 --artifactDir=simulation-output --candidate=$candidate --writeTextReport=true --textReportFileName=candidate-report.txt

# 3) Auto-balance search run
npm run autobalance -- --seed=ga-1 --runName=autobalance-ga-1 --generations=4 --population=12 --elite=3 --runs=80 --parallelism=6 --candidateParallelism=2 --turnCap=120 --artifactDir=simulation-output

# Optional: compiled JS path for long runs
npm run build
npm run autobalance:js -- --seed=ga-js --runName=autobalance-ga-js --generations=4 --population=12 --elite=3 --runs=80 --parallelism=6 --candidateParallelism=2 --turnCap=120 --artifactDir=simulation-output
```

### Fast mode for parallel simulation (recommended)

For high-parallel simulation workloads, use the in-memory DB client:

**PowerShell**
```powershell
$env:SAVE_THE_DRAGON_DB_CLIENT='in-memory'
```

Reset to SQLite mode:

**PowerShell**
```powershell
$env:SAVE_THE_DRAGON_DB_CLIENT='sqlite'
```

> Tip: `in-memory` mode is ideal for simulations/autobalancing because runs are transient and do not need durable persistence.

### Simulation runner (`npm run simulate`)

Basic run:

```sh
npm run simulate -- --seed=baseline --runName=simulate-baseline --runs=100 --parallelism=6 --playersPerGame=3 --turnCap=150 --artifactDir=simulation-output
```

Run with report + per-game logs:

```sh
npm run simulate -- --seed=loot-equip-check --runName=simulate-loot-equip-check --runs=50 --parallelism=6 --turnCap=120 --artifactDir=simulation-output --writeTextReport=true --textReportFileName=report.txt --writePerGameLogs=true
```

Run with candidate overrides:

```sh
npm run simulate -- --seed=candidate-1 --runName=simulate-candidate-1 --runs=100 --parallelism=6 --candidate='{"item":{"dropRates":{"healthItemMultiplier":2.0,"extraHeartMultiplier":2.5}}}'
```

Baseline vs candidate compare mode:

```sh
npm run simulate:compare -- --seed=compare-1 --runName=simulate-compare-1 --runs=100 --parallelism=6 --candidate='{"biomeEncounterRates":{"plains":0.18},"monster":{"variantModifiers":{"strong":{"attack":2}}}}'
```

Use compiled JS (faster startup for repeated runs):

```sh
npm run build
npm run simulate:js -- --seed=baseline --runName=simulate-baseline-js --runs=100 --parallelism=6
```

#### Simulation flags

- `--seed`: deterministic batch seed
- `--runName`: output folder name (defaults to `simulate-<seed>`)
- `--runs`: number of games in batch
- `--parallelism`: simultaneous games per batch
- `--playersPerGame`: bots per game
- `--turnCap`: max turns before timeout
- `--candidate`: JSON override payload
- `--artifactDir`: root artifact directory (run subfolder is auto-created)
- `--writeTextReport=true`: write human-readable report
- `--textReportFileName=<name>.txt`: report filename
- `--writePerGameLogs=true`: write per-game JSON logs
- `--progressEvery=<n>`: log progress every `n` completed runs

### Auto-balancer (`npm run autobalance`)

Basic auto-balance run:

```sh
npm run autobalance -- --seed=ga-1 --runName=autobalance-ga-1 --generations=6 --population=12 --elite=3 --runs=80 --parallelism=6 --turnCap=150 --artifactDir=simulation-output
```

Higher throughput run (in-memory + compiled JS + parallel candidate evaluation):

```powershell
$env:SAVE_THE_DRAGON_DB_CLIENT='in-memory'
cd server
npm run build
npm run autobalance:js -- --seed=ga-fast --runName=autobalance-ga-fast --generations=4 --population=16 --elite=4 --runs=120 --parallelism=8 --candidateParallelism=4 --progressEveryRuns=10 --turnCap=120 --artifactDir=simulation-output
```

Profile-floor focused run (pushes all behavior profiles toward a minimum win chance):

```powershell
$env:SAVE_THE_DRAGON_DB_CLIENT='in-memory'
cd server
npm run autobalance -- --seed=ga-profile-floor --runName=autobalance-ga-profile-floor --generations=6 --population=16 --elite=4 --runs=120 --parallelism=8 --candidateParallelism=4 --turnCap=120 --artifactDir=simulation-output --targetWinRate=0.35 --minBeatableRate=0.30 --minProfileWinRate=0.15 --maxProfileTimeoutRate=0.30 --maxTimeoutRate=0.30 --profileFloorWeight=3
```

#### Auto-balancer flags

- `--seed`, `--runName`, `--artifactDir`
- `--generations`: number of evolutionary generations
- `--population`: candidates per generation
- `--elite`: top candidates preserved each generation
- `--mutationRate`: mutation intensity (default ~`0.28`)
- `--runs`: games per candidate evaluation
- `--parallelism`: game-level parallelism inside each candidate run
- `--candidateParallelism`: number of candidates evaluated concurrently per generation
- `--progressEveryRuns`: progress log cadence per batch
- `--reportRuns`: runs used for final best-candidate detailed report
- `--turnCap`, `--playersPerGame`
- `--targetWinLossRatio`: preferred global win/loss ratio target
- `--targetWinRate`: preferred global win rate target
- `--minBeatableRate`: minimum acceptable beatable rate target
- `--maxTimeoutRate`: global timeout ceiling used by fitness
- `--maxEarlyLossRate`: global early-loss ceiling used by fitness
- `--minProfileWinRate`: minimum win-rate floor per behavior profile (`risk-averse`, `aggressive`, `completionist`)
- `--maxProfileTimeoutRate`: per-profile timeout ceiling
- `--profileFloorWeight`: weight of per-profile win floor penalty in fitness

### Live progress and artifacts

During runs, console progress includes:

- completed/total runs
- percent complete
- active runs
- estimated throughput (`rpm`)
- ETA

Artifacts are written to:

- `simulation-output/<runName>/summary-<timestamp>.json`
- `simulation-output/<runName>/games-<timestamp>.json` (if `--writePerGameLogs=true`)
- `simulation-output/<runName>/<reportFile>.txt` (if `--writeTextReport=true`)
- `simulation-output/<runName>/autobalance-<seed>-result.json` (autobalancer)

Progress snapshots are also written as JSON in the same run folder (`progress-*.json`).

### What auto-balancer actually accomplishes

The auto-balancer searches over scale/tuning genes (encounter rates, monster/item base scales, variant scales/chance deltas, and health-item drop scales), then:

1. Runs a baseline batch.
2. Evaluates candidate overrides across generations.
3. Scores each candidate by fitness (win/loss behavior, beatable rate, timeout controls, fail-signal penalties).
4. Produces a recommended `applyOverrides` object in `autobalance-<seed>-result.json`.

Use the output as a **recommended candidate**, not a guaranteed final answer.

### How to apply autobalancer output to the server

Recommended workflow:

1. Run autobalancer and open `autobalance-<seed>-result.json`.
2. Copy `recommendation.applyOverrides`.
3. Re-run `simulate` with that payload via `--candidate='...json...'` for validation.
4. If results are acceptable, apply values to server balance sources:
    - `server/constants/biomes.ts`
    - `server/constants/monsters.ts`
    - `server/constants/items.ts`
5. Re-run simulation to confirm no regression.

### Practical tuning guidance

- Start with `simulate` for small focused changes.
- Use `autobalance` when manual tuning stalls.
- Prefer `in-memory` DB client for parallel simulation.
- Increase `parallelism` first, then `candidateParallelism`.
- If host CPU is under-utilized, increase concurrency in steps and monitor stability.

## Server Architecture
- **Routes (`server/routes/`)**
   - HTTP-focused controllers only: parse params/body, call services, return status + JSON.
- **Services (`server/services/`)**
   - Game/business rules live here (`gameService`, `battleService`, `playerService`, `adminService`).
   - Services throw typed errors for route-level HTTP mapping.
- **Repositories (`server/repositories/`)**
   - SQLite data access is centralized here (`gameRepository`, `dbClient`).
   - Raw SQL is isolated from route and game-rule modules.

This separation keeps the API layer thin, game logic reusable/testable, and SQL concerns encapsulated.

## Completed Backlog Highlights
- **BACKLOG-001:** Server architecture refactor completed (routes/controllers + service layer + repository layer boundaries).
- **BACKLOG-002:** Loot flow supports immediate `Equip Now` / `Use Now` with server-authoritative updates reflected in UI without refresh.
- **BACKLOG-003:** Inventory-heavy modals are scroll-safe with persistent action controls.
- **BACKLOG-004:** Castle danger zone expanded and volcano encounter rate set to 100%.
- **BACKLOG-005:** Curved biome-tier balancing implemented for monsters and gear progression:
   - Early game: plains/forest tuned for starter survivability.
   - Mid game: desert tuned as a meaningful progression step.
   - Late game: cave/volcano tuned as high-threat zones.
   - Item/monster stats remain tied to existing IDs, names, images, and biome assignments.
   - Chance bar UI now supports dynamic percentages (not limited to fixed 50/70/90 buckets).
- **BACKLOG-007:** Shared raid-boss win condition implemented with persistent boss HP and global game-complete state.
- **BACKLOG-013:** Movement now uses click-to-select destination and `End Turn` confirmation with visual destination highlight and path arrow.

## Recent Fixes & UX Updates
- Admin quality-of-life updates:
   - Per-action success/error toasts for admin controls.
   - Kick button text style normalized (`Kick`) for alignment/readability.
- Battle UI health scaling:
   - Battle cards now display current HP numerically instead of rendering one heart per HP.
- Item and consumable fixes:
   - No random weapon variant can be weaker than starter baseline (`>=2` attack, `>=0.5` attack chance).
   - Using stacked consumables now consumes one item per use instead of all matching copies.
- Player list stat badges:
   - Player row now shows `Health`, `Attack`, `Defense` icon+value badges.
   - Alignment updated so Attack/Defense are left and Health is right-emphasized.
   - Badge class naming refactored from health-specific to generic stat naming.

## License
This project is for educational and personal use.
