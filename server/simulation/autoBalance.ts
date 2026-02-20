import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createSeededRandom } from '../utils/random.js';
import type { BiomeDeckConfig, PlayBiome } from '../config/biomeDeckConfig.js';
import type { GameBalanceConfig } from '../config/gameBalanceConfig.js';
import { runApiSimulation, type AggregateResult, type SimOptions } from './deckBalanceSimulator.js';

type Genome = {
	monsterEncounterScale: number;
	itemEncounterScale: number;
	consumableEncounterScale: number;
	heartEncounterScale: number;
	lootItemScale: number;
	lootConsumableScale: number;
	lootHeartScale: number;
	strongWeightScale: number;
	weakWeightScale: number;
	monsterStatScale: number;
	itemStatScale: number;
	consumableHealScale: number;
};

type Candidate = {
	genome: Genome;
	fitness: number;
	aggregate: AggregateResult;
	deckConfig: BiomeDeckConfig;
	balanceConfig: GameBalanceConfig;
};

type WorkerSimulationResult = {
	aggregate: AggregateResult;
};

type Args = {
	seed: string;
	games: number;
	maxTurns: number;
	gridSizeX: number;
	gridSizeY: number;
	generations: number;
	population: number;
	elite: number;
	candidateParallelism: number;
	targetSuccessRate: number;
	targetMinTurns: number;
	targetAvgTurns: number;
	targetMaxTurns: number;
	successPenaltyWeight: number;
	minTurnsPenaltyWeight: number;
	turnsPenaltyWeight: number;
	maxTurnsPenaltyWeight: number;
	artifactDir: string;
	runName: string;
	baseDeckPath: string;
	baseBalancePath: string;
};

function parseArgs(argv: string[]): Record<string, string> {
	const output: Record<string, string> = {};
	for (const arg of argv) {
		if (!arg.startsWith('--')) continue;
		const [key, ...rest] = arg.slice(2).split('=');
		output[key] = rest.length > 0 ? rest.join('=') : 'true';
	}
	return output;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function parseRuntimeArgs(raw: Record<string, string>): Args {
	const seed = raw.seed || `deck-autobalance-${Date.now()}`;
	const runName = raw.runName || seed;
	const artifactDir = raw.artifactDir || 'simulation-output';

	return {
		seed,
		games: Math.max(10, Number(raw.games || 40)),
		maxTurns: Math.max(30, Number(raw.maxTurns || 120)),
		gridSizeX: Math.max(10, Number(raw.gridSizeX || 20)),
		gridSizeY: Math.max(10, Number(raw.gridSizeY || 20)),
		generations: Math.max(1, Number(raw.generations || 4)),
		population: Math.max(4, Number(raw.population || 10)),
		elite: Math.max(1, Number(raw.elite || 3)),
		candidateParallelism: Math.max(1, Number(raw.candidateParallelism || 2)),
		targetSuccessRate: clamp(Number(raw.targetSuccessRate || raw.targetCompletionRate || 1.0), 0, 1),
		targetMinTurns: Math.max(1, Number(raw.targetMinTurns || 30)),
		targetAvgTurns: Math.max(20, Number(raw.targetAvgTurns || 95)),
		targetMaxTurns: Math.max(20, Number(raw.targetMaxTurns || 100)),
		successPenaltyWeight: Math.max(0, Number(raw.successPenaltyWeight || 1.8)),
		minTurnsPenaltyWeight: Math.max(0, Number(raw.minTurnsPenaltyWeight || 0.8)),
		turnsPenaltyWeight: Math.max(0, Number(raw.turnsPenaltyWeight || 0.35)),
		maxTurnsPenaltyWeight: Math.max(0, Number(raw.maxTurnsPenaltyWeight || 1.1)),
		artifactDir,
		runName,
		baseDeckPath: raw.baseDeckPath || path.resolve(process.cwd(), 'config', 'biome-decks.json'),
		baseBalancePath: raw.baseBalancePath || path.resolve(process.cwd(), 'config', 'game-balance.json'),
	};
}

function normalizeWeights(weights: { weak: number; normal: number; strong: number }) {
	const total = Math.max(0.0001, weights.weak + weights.normal + weights.strong);
	return {
		weak: weights.weak / total,
		normal: weights.normal / total,
		strong: weights.strong / total,
	};
}

function clampChance(value: number): number {
	return clamp(Number(value.toFixed(4)), 0.05, 0.95);
}

function toCount(value: number): number {
	return Math.max(0, Math.round(value));
}

function buildRandomGenome(rand: () => number): Genome {
	return {
		monsterEncounterScale: 0.65 + rand() * 0.9,
		itemEncounterScale: 0.65 + rand() * 0.9,
		consumableEncounterScale: 0.6 + rand() * 1.4,
		heartEncounterScale: 0.4 + rand() * 1.8,
		lootItemScale: 0.7 + rand() * 0.9,
		lootConsumableScale: 0.6 + rand() * 1.2,
		lootHeartScale: 0.3 + rand() * 1.6,
		strongWeightScale: 0.6 + rand() * 1.1,
		weakWeightScale: 0.6 + rand() * 1.1,
		monsterStatScale: 0.75 + rand() * 0.7,
		itemStatScale: 0.75 + rand() * 0.7,
		consumableHealScale: 0.7 + rand() * 1.1,
	};
}

function crossover(a: Genome, b: Genome, rand: () => number): Genome {
	const mix = (left: number, right: number) => left * (1 - rand()) + right * rand();
	return {
		monsterEncounterScale: mix(a.monsterEncounterScale, b.monsterEncounterScale),
		itemEncounterScale: mix(a.itemEncounterScale, b.itemEncounterScale),
		consumableEncounterScale: mix(a.consumableEncounterScale, b.consumableEncounterScale),
		heartEncounterScale: mix(a.heartEncounterScale, b.heartEncounterScale),
		lootItemScale: mix(a.lootItemScale, b.lootItemScale),
		lootConsumableScale: mix(a.lootConsumableScale, b.lootConsumableScale),
		lootHeartScale: mix(a.lootHeartScale, b.lootHeartScale),
		strongWeightScale: mix(a.strongWeightScale, b.strongWeightScale),
		weakWeightScale: mix(a.weakWeightScale, b.weakWeightScale),
		monsterStatScale: mix(a.monsterStatScale, b.monsterStatScale),
		itemStatScale: mix(a.itemStatScale, b.itemStatScale),
		consumableHealScale: mix(a.consumableHealScale, b.consumableHealScale),
	};
}

function mutate(genome: Genome, mutationRate: number, rand: () => number): Genome {
	const maybeMutate = (value: number, span: number, min: number, max: number) => {
		if (rand() > mutationRate) return value;
		return clamp(value + (rand() * 2 - 1) * span, min, max);
	};
	return {
		monsterEncounterScale: maybeMutate(genome.monsterEncounterScale, 0.22, 0.4, 1.8),
		itemEncounterScale: maybeMutate(genome.itemEncounterScale, 0.22, 0.4, 1.8),
		consumableEncounterScale: maybeMutate(genome.consumableEncounterScale, 0.25, 0.3, 2.4),
		heartEncounterScale: maybeMutate(genome.heartEncounterScale, 0.3, 0.1, 2.8),
		lootItemScale: maybeMutate(genome.lootItemScale, 0.22, 0.3, 2.0),
		lootConsumableScale: maybeMutate(genome.lootConsumableScale, 0.25, 0.2, 2.4),
		lootHeartScale: maybeMutate(genome.lootHeartScale, 0.3, 0.1, 2.8),
		strongWeightScale: maybeMutate(genome.strongWeightScale, 0.2, 0.2, 2.0),
		weakWeightScale: maybeMutate(genome.weakWeightScale, 0.2, 0.2, 2.0),
		monsterStatScale: maybeMutate(genome.monsterStatScale, 0.16, 0.6, 1.7),
		itemStatScale: maybeMutate(genome.itemStatScale, 0.16, 0.6, 1.7),
		consumableHealScale: maybeMutate(genome.consumableHealScale, 0.2, 0.4, 2.0),
	};
}

function applyGenome(
	baseDeck: BiomeDeckConfig,
	baseBalance: GameBalanceConfig,
	genome: Genome
): { deckConfig: BiomeDeckConfig; balanceConfig: GameBalanceConfig } {
	const deckConfig: BiomeDeckConfig = structuredClone(baseDeck);
	const balanceConfig: GameBalanceConfig = structuredClone(baseBalance);
	const biomeOrder: PlayBiome[] = ['plains', 'forest', 'desert', 'cave', 'volcano'];

	for (const biome of biomeOrder) {
		const template = deckConfig.BIOME_DECKS[biome];
		template.encounterComposition.monster = toCount(template.encounterComposition.monster * genome.monsterEncounterScale);
		template.encounterComposition.item = toCount(template.encounterComposition.item * genome.itemEncounterScale);
		template.encounterComposition.consumable = toCount(template.encounterComposition.consumable * genome.consumableEncounterScale);
		template.encounterComposition.heart = toCount(template.encounterComposition.heart * genome.heartEncounterScale);

		template.lootComposition.item = toCount(template.lootComposition.item * genome.lootItemScale);
		template.lootComposition.consumable = toCount(template.lootComposition.consumable * genome.lootConsumableScale);
		template.lootComposition.heart = toCount(template.lootComposition.heart * genome.lootHeartScale);

		const totalEncounter =
			template.encounterComposition.monster +
			template.encounterComposition.item +
			template.encounterComposition.consumable +
			template.encounterComposition.heart;
		if (totalEncounter <= 0) {
			template.encounterComposition.monster = 1;
		}

		const nonMonsterEncounter =
			template.encounterComposition.item +
			template.encounterComposition.consumable +
			template.encounterComposition.heart;
		if (template.encounterComposition.monster <= nonMonsterEncounter) {
			template.encounterComposition.monster = nonMonsterEncounter + 1;
		}

		const totalLoot = template.lootComposition.item + template.lootComposition.consumable + template.lootComposition.heart;
		if (totalLoot <= 0) {
			template.lootComposition.item = 1;
		}

		const scaledWeights = normalizeWeights({
			weak: template.monsterVariantWeights.weak * genome.weakWeightScale,
			normal: template.monsterVariantWeights.normal,
			strong: template.monsterVariantWeights.strong * genome.strongWeightScale,
		});
		template.monsterVariantWeights = scaledWeights;
	}

	for (const biome of ['plains', 'forest', 'desert', 'cave', 'volcano'] as const) {
		const monsterBase = balanceConfig.BIOME_TIER_BASE_STATS[biome];
		monsterBase.health = Math.max(1, Math.round(monsterBase.health * genome.monsterStatScale));
		monsterBase.attack = Math.max(1, Math.round(monsterBase.attack * genome.monsterStatScale));
		monsterBase.defense = Math.max(0, Math.round(monsterBase.defense * genome.monsterStatScale));
		monsterBase.attackChance = clampChance(monsterBase.attackChance + (genome.monsterStatScale - 1) * 0.08);
		monsterBase.defenseChance = clampChance(monsterBase.defenseChance + (genome.monsterStatScale - 1) * 0.08);

		const weaponBase = balanceConfig.ITEM_TIER_BASE.weapon[biome];
		weaponBase.attack = Math.max(1, Math.round(weaponBase.attack * genome.itemStatScale));
		weaponBase.attackChance = clampChance(weaponBase.attackChance + (genome.itemStatScale - 1) * 0.06);

		const armorBase = balanceConfig.ITEM_TIER_BASE.armor[biome];
		armorBase.defense = Math.max(0, Math.round(armorBase.defense * genome.itemStatScale));
		armorBase.defenseChance = clampChance(armorBase.defenseChance + (genome.itemStatScale - 1) * 0.06);
	}

	balanceConfig.CONSUMABLES.smallPotionHeal = Math.max(1, Math.round(balanceConfig.CONSUMABLES.smallPotionHeal * genome.consumableHealScale));
	balanceConfig.CONSUMABLES.mediumPotionHeal = Math.max(1, Math.round(balanceConfig.CONSUMABLES.mediumPotionHeal * genome.consumableHealScale));
	balanceConfig.CONSUMABLES.largePotionHeal = Math.max(1, Math.round(balanceConfig.CONSUMABLES.largePotionHeal * genome.consumableHealScale));
	balanceConfig.CONSUMABLES.fullPotionHeal = Math.max(
		balanceConfig.CONSUMABLES.largePotionHeal + 1,
		Math.round(balanceConfig.CONSUMABLES.fullPotionHeal * clamp(genome.consumableHealScale, 0.9, 1.4))
	);

	return { deckConfig, balanceConfig };
}

function getTsxBinPath(): string {
	return 'tsx';
}

async function runSimulationWorker(simOptions: SimOptions): Promise<WorkerSimulationResult> {
	const workerScript = path.resolve(process.cwd(), 'simulation', 'candidateSimulationWorker.ts');
	const tsxLoader = getTsxBinPath();
	const args = [
		'--import',
		tsxLoader,
		workerScript,
		`--games=${simOptions.games}`,
		`--maxTurns=${simOptions.maxTurns}`,
		`--seed=${simOptions.seed}`,
		`--gridSizeX=${simOptions.gridSizeX}`,
		`--gridSizeY=${simOptions.gridSizeY}`,
		`--playerName=${simOptions.playerName}`,
		`--biomeDeckConfigPath=${simOptions.biomeDeckConfigPath || ''}`,
		`--gameBalanceConfigPath=${simOptions.gameBalanceConfigPath || ''}`,
	];

	return await new Promise<WorkerSimulationResult>((resolve, reject) => {
		const child = spawn(process.execPath, args, {
			cwd: process.cwd(),
			env: { ...process.env },
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';
		child.stdout.on('data', chunk => {
			stdout += chunk.toString();
		});
		child.stderr.on('data', chunk => {
			stderr += chunk.toString();
		});

		child.on('error', error => {
			reject(error);
		});

		child.on('close', code => {
			if (code !== 0) {
				reject(
					new Error(
						`candidate worker exited with code ${code}. ${stderr.trim() || stdout.trim() || 'no worker output'}`
					)
				);
				return;
			}

			const lines = stdout
				.split(/\r?\n/)
				.map(line => line.trim())
				.filter(Boolean);
			const jsonLine = lines[lines.length - 1];
			if (!jsonLine) {
				reject(new Error(`candidate worker produced no stdout. stderr=${stderr.trim() || 'none'}`));
				return;
			}

			try {
				const parsed = JSON.parse(jsonLine) as WorkerSimulationResult;
				resolve(parsed);
			} catch (error) {
				reject(
					new Error(
						`candidate worker output was not valid JSON. output=${jsonLine.slice(0, 300)} error=${error instanceof Error ? error.message : String(error)}`
					)
				);
			}
		});
	});
}

async function evaluateCandidate(
	baseDeck: BiomeDeckConfig,
	baseBalance: GameBalanceConfig,
	genome: Genome,
	args: Args,
	seedSuffix: string
): Promise<Candidate> {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dragon-ga-'));
	const deckPath = path.join(tempDir, 'biome-decks.json');
	const balancePath = path.join(tempDir, 'game-balance.json');
	const { deckConfig, balanceConfig } = applyGenome(baseDeck, baseBalance, genome);
	await fs.writeFile(deckPath, JSON.stringify(deckConfig, null, 2), 'utf8');
	await fs.writeFile(balancePath, JSON.stringify(balanceConfig, null, 2), 'utf8');

	try {
		const simOptions: SimOptions = {
			games: args.games,
			maxTurns: args.maxTurns,
			seed: `${args.seed}-${seedSuffix}`,
			gridSizeX: args.gridSizeX,
			gridSizeY: args.gridSizeY,
			playerName: 'AutoBalanceBot',
			biomeDeckConfigPath: deckPath,
			gameBalanceConfigPath: balancePath,
		};

		const output = await runSimulationWorker(simOptions);

		const successPenalty = Math.abs(output.aggregate.successRate - args.targetSuccessRate);
		const minTurnsPenalty =
			output.aggregate.minTurnsPlayed < args.targetMinTurns
				? (args.targetMinTurns - output.aggregate.minTurnsPlayed) / args.targetMinTurns
				: 0;
		const turnsPenalty = Math.abs(output.aggregate.avgTurnsPlayed - args.targetAvgTurns) / args.targetAvgTurns;
		const maxTurnsPenalty =
			output.aggregate.maxTurnsPlayed > args.targetMaxTurns
				? (output.aggregate.maxTurnsPlayed - args.targetMaxTurns) / args.targetMaxTurns
				: 0;
		const fitness = Number(
			(
				1 -
				(
					successPenalty * args.successPenaltyWeight +
					minTurnsPenalty * args.minTurnsPenaltyWeight +
					turnsPenalty * args.turnsPenaltyWeight +
					maxTurnsPenalty * args.maxTurnsPenaltyWeight
				)
			).toFixed(6)
		);

		return {
			genome,
			fitness,
			aggregate: output.aggregate,
			deckConfig,
			balanceConfig,
		};
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
}

async function evaluateCandidateWithRetry(
	baseDeck: BiomeDeckConfig,
	baseBalance: GameBalanceConfig,
	genome: Genome,
	args: Args,
	seedSuffix: string
): Promise<Candidate> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await evaluateCandidate(baseDeck, baseBalance, genome, args, `${seedSuffix}-a${attempt}`);
		} catch (error) {
			lastError = error;
			if (attempt < 3) {
				await new Promise(resolve => setTimeout(resolve, attempt * 250));
			}
		}
	}
	throw lastError;
}

async function evaluatePopulation(
	population: Genome[],
	baseDeck: BiomeDeckConfig,
	baseBalance: GameBalanceConfig,
	args: Args,
	generation: number
): Promise<Candidate[]> {
	const results: Candidate[] = new Array(population.length);
	let nextIndex = 0;
	const workerCount = Math.min(args.candidateParallelism, population.length);

	const workers = Array.from({ length: Math.min(workerCount, population.length) }, async () => {
		while (true) {
			const index = nextIndex;
			nextIndex += 1;
			if (index >= population.length) break;
			try {
				const candidate = await evaluateCandidateWithRetry(
					baseDeck,
					baseBalance,
					population[index],
					args,
					`g${generation + 1}-c${index + 1}`
				);
				results[index] = candidate;
				console.error(
					`[autobalance] g${generation + 1} c${index + 1}/${population.length} fitness=${candidate.fitness.toFixed(4)} success=${(candidate.aggregate.successRate * 100).toFixed(1)}% avgTurns=${candidate.aggregate.avgTurnsPlayed.toFixed(1)}`
				);
			} catch (error) {
				const fallback = await evaluateCandidateWithRetry(
					baseDeck,
					baseBalance,
					buildRandomGenome(createSeededRandom(`${args.seed}-fallback-${generation + 1}-${index + 1}`)),
					args,
					`g${generation + 1}-fallback-c${index + 1}`
				);
				results[index] = fallback;
				console.error(
					`[autobalance] g${generation + 1} c${index + 1}/${population.length} failed; substituted fallback. error=${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	});

	await Promise.all(workers);
	return results;
}

async function main() {
	const args = parseRuntimeArgs(parseArgs(process.argv.slice(2)));
	const startedAt = Date.now();
	const rand = createSeededRandom(args.seed);
	const mutationRate = 0.3;

	console.error(
		`[autobalance] seed=${args.seed} generations=${args.generations} population=${args.population} games=${args.games} maxTurns=${args.maxTurns}`
	);

	const baseDeck = JSON.parse(await fs.readFile(args.baseDeckPath, 'utf8')) as BiomeDeckConfig;
	const baseBalance = JSON.parse(await fs.readFile(args.baseBalancePath, 'utf8')) as GameBalanceConfig;

	const runFolder = `${args.runName}`
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-_]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '') || `autobalance-${Date.now()}`;
	const artifactDir = path.resolve(process.cwd(), args.artifactDir, runFolder);
	await fs.mkdir(artifactDir, { recursive: true });

	let population = Array.from({ length: args.population }, () => buildRandomGenome(rand));
	let best: Candidate | null = null;
	const history: Array<{
		generation: number;
		bestFitness: number;
		successRate: number;
		minTurnsPlayed: number;
		avgTurnsPlayed: number;
		maxTurnsPlayed: number;
		bossDefeatRate: number;
	}> = [];

	for (let generation = 0; generation < args.generations; generation += 1) {
		console.error(`[autobalance] generation ${generation + 1}/${args.generations} started`);
		const evaluated = await evaluatePopulation(population, baseDeck, baseBalance, args, generation);
		evaluated.sort((left, right) => right.fitness - left.fitness);
		const generationBest = evaluated[0];
		if (!best || generationBest.fitness > best.fitness) {
			best = generationBest;
		}
		history.push({
			generation: generation + 1,
			bestFitness: generationBest.fitness,
			successRate: generationBest.aggregate.successRate,
			minTurnsPlayed: generationBest.aggregate.minTurnsPlayed,
			avgTurnsPlayed: generationBest.aggregate.avgTurnsPlayed,
			maxTurnsPlayed: generationBest.aggregate.maxTurnsPlayed,
			bossDefeatRate: generationBest.aggregate.successRate,
		});

		console.error(
			`[autobalance] generation ${generation + 1} best fitness=${generationBest.fitness.toFixed(4)} success=${(generationBest.aggregate.successRate * 100).toFixed(1)}% min/avg/max=${generationBest.aggregate.minTurnsPlayed}/${generationBest.aggregate.avgTurnsPlayed.toFixed(1)}/${generationBest.aggregate.maxTurnsPlayed}`
		);

		const next: Genome[] = evaluated.slice(0, Math.min(args.elite, evaluated.length)).map(entry => entry.genome);
		while (next.length < args.population) {
			const parentA = evaluated[Math.floor(rand() * Math.min(6, evaluated.length))].genome;
			const parentB = evaluated[Math.floor(rand() * Math.min(6, evaluated.length))].genome;
			next.push(mutate(crossover(parentA, parentB, rand), mutationRate, rand));
		}
		population = next;
	}

	if (!best) {
		throw new Error('No candidate evaluated');
	}

	const bestDeckPath = path.join(artifactDir, 'best-biome-decks.json');
	const bestBalancePath = path.join(artifactDir, 'best-game-balance.json');
	await fs.writeFile(bestDeckPath, JSON.stringify(best.deckConfig, null, 2), 'utf8');
	await fs.writeFile(bestBalancePath, JSON.stringify(best.balanceConfig, null, 2), 'utf8');

	const baselineSummary = await runApiSimulation(
		{
			games: args.games,
			maxTurns: args.maxTurns,
			seed: `${args.seed}-baseline`,
			gridSizeX: args.gridSizeX,
			gridSizeY: args.gridSizeY,
			playerName: 'AutoBalanceBot',
			biomeDeckConfigPath: args.baseDeckPath,
			gameBalanceConfigPath: args.baseBalancePath,
		},
		{ writeArtifacts: true, artifactRoot: path.join(args.artifactDir, runFolder), runName: 'baseline-report' }
	);

	const bestSummary = await runApiSimulation(
		{
			games: Math.max(args.games, 50),
			maxTurns: args.maxTurns,
			seed: `${args.seed}-best`,
			gridSizeX: args.gridSizeX,
			gridSizeY: args.gridSizeY,
			playerName: 'AutoBalanceBot',
			biomeDeckConfigPath: bestDeckPath,
			gameBalanceConfigPath: bestBalancePath,
		},
		{ writeArtifacts: true, artifactRoot: path.join(args.artifactDir, runFolder), runName: 'best-report' }
	);

	const output = {
		meta: {
			seed: args.seed,
			generations: args.generations,
			population: args.population,
			candidateParallelism: args.candidateParallelism,
			gamesPerCandidate: args.games,
			durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
			targets: {
				successRate: args.targetSuccessRate,
				minTurns: args.targetMinTurns,
				avgTurns: args.targetAvgTurns,
				maxTurns: args.targetMaxTurns,
				successPenaltyWeight: args.successPenaltyWeight,
				minTurnsPenaltyWeight: args.minTurnsPenaltyWeight,
				turnsPenaltyWeight: args.turnsPenaltyWeight,
				maxTurnsPenaltyWeight: args.maxTurnsPenaltyWeight,
			},
		},
		history,
		bestCandidate: {
			fitness: best.fitness,
			bossDefeatRate: best.aggregate.successRate,
			aggregate: best.aggregate,
			genome: best.genome,
			bestDeckPath,
			bestBalancePath,
		},
		baselineAggregate: baselineSummary.aggregate,
		bestDetailedAggregate: bestSummary.aggregate,
	};

	const resultPath = path.join(artifactDir, 'autobalance-result.json');
	await fs.writeFile(resultPath, JSON.stringify(output, null, 2), 'utf8');
	console.error(`[autobalance] complete. result: ${resultPath}`);
	console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
	console.error('Auto-balance failed:', error);
	process.exitCode = 1;
});
