# AI Balancing Notes (2026-02-16)

## Scope
Applied the latest validated auto-balancing candidate (`ga-profile-floor-r2`) directly into server constants and captured findings for the next iteration.

## What Was Applied
From `server/simulation-output/autobalance-ga-profile-floor-r2/autobalance-ga-profile-floor-r2-result.json` (`recommendation.applyOverrides`):

- `server/constants/biomes.ts`
  - Encounter rates set to `0.5172` for `plains|forest|desert|cave|volcano`
  - `castle` and `town` remain `0`

- `server/constants/monsters.ts`
  - Lowered base stats across all combat biomes (e.g. plains now `health:1, attack:1`)
  - Lowered variant spread (`weak/strong` now small chance deltas instead of stat swings)

- `server/constants/items.ts`
  - Raised mid/high tier weapon+armor values (tier 2/3 now `5/7`)
  - Narrowed variant chance deltas to ±`0.0596`
  - Drop profile tuned: `healthItemMultiplier=0.6452`, `extraHeartMultiplier=3.1553`

## Key Findings
Using the same `ga-profile-floor-r2` run:

- Baseline before applying candidate (120 runs):
  - `winRate=0.00%`, `lossRate=95.83%`, `timeoutRate=4.17%`

- Best candidate summary during search (120 runs):
  - `winRate=6.67%`, `lossRate=83.33%`, `timeoutRate=10.00%`, `beatableRate=6.67%`
  - Profile win rates:
    - `risk-averse=8.89%`
    - `aggressive=7.23%`
    - `completionist=5.00%`

- Detailed best-candidate report (120 runs):
  - `winRate=5.00%`, `lossRate=72.50%`, `timeoutRate=22.50%`
  - Profile win rates:
    - `risk-averse=6.17%`
    - `aggressive=4.30%`
    - `completionist=6.98%`

Interpretation:
- Directionally better than 0% wins and all profiles now win occasionally.
- Still below target for “good chance to win” (suggested next gate: minimum 10% per profile, then 15–20%).
- Timeout conversion remains significant in some candidates, so finishing power still needs work.

## Recommended Next Iteration
1. Keep profile-floor fitness enabled and prioritize:
   - `minProfileWinRate >= 0.10` first, then `>= 0.15`
2. Increase finisher pressure while controlling timeout:
   - Slightly increase tier 2/3 weapon attack+chance
   - Slightly reduce cave/volcano defense or defenseChance
3. Use staged simulation confidence:
   - Explore: 80 runs
   - Compare: 200 runs
   - Confirm: 500 runs

## Commands Used Today (Representative)
```powershell
$env:SAVE_THE_DRAGON_DB_CLIENT='in-memory'
cd server
npm run build
npm run autobalance:js -- --seed=ga-profile-floor-r2 --runName=autobalance-ga-profile-floor-r2 --generations=4 --population=14 --elite=4 --runs=120 --parallelism=8 --candidateParallelism=4 --turnCap=120 --artifactDir=simulation-output --targetWinRate=0.35 --minBeatableRate=0.30 --minProfileWinRate=0.15 --maxProfileTimeoutRate=0.30 --maxTimeoutRate=0.30 --profileFloorWeight=4 --mutationRate=0.35 --reportRuns=120
```

## Files Changed Today
- `server/simulation/autoBalance.ts` (profile-floor fitness + wider search ranges)
- `server/constants/biomes.ts`
- `server/constants/monsters.ts`
- `server/constants/items.ts`
- `README.md` (new autobalancer fitness flags and profile-floor run example)
