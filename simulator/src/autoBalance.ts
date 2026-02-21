import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createSeededRandom } from './random.js';
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
	consumableHealScale: number;
};

type BalanceDeck = 'forest' | 'desert' | 'volcano';

type BalanceJsonConfig = {
	weapons: Record<BalanceDeck, { minAttack: number; maxAttack: number; minChance: number; maxChance: number }>;
	armors: Record<BalanceDeck, { minDefense: number; maxDefense: number; minChance: number; maxChance: number }>;
	itemVariance: {
		cracked: { valueDelta: number; chanceDelta: number };
		normal: { valueDelta: number; chanceDelta: number };
		enchanted: { valueDelta: number; chanceDelta: number };
	};
	consumables: {
		smallPotionHeal: number;
		mediumPotionHeal: number;
		largePotionHeal: number;
	};
	itemConsumables: Record<
		BalanceDeck,
		{
			teleport: number;
			smallHealthPotion: number;
			mediumHealthPotion: number;
			largeHealthPotion: number;
			fullHealthPotion: number;
			extraHeart: number;
		}
	>;
	monsters: Record<
		BalanceDeck,
		{
			minHealth: number;
			maxHealth: number;
			minAttack: number;
			maxAttack: number;
			minAttackChance: number;
			maxAttackChance: number;
			minDefense: number;
			maxDefense: number;
			minDefenseChance: number;
			maxDefenseChance: number;
		}
	>;
	monsterVariance: {
		weak: { healthDelta: number; attackDelta: number; attackChanceDelta: number; defenseDelta: number; defenseChanceDelta: number };
		normal: { healthDelta: number; attackDelta: number; attackChanceDelta: number; defenseDelta: number; defenseChanceDelta: number };
		strong: { healthDelta: number; attackDelta: number; attackChanceDelta: number; defenseDelta: number; defenseChanceDelta: number };
	};
	monsterConsumables: Record<
		BalanceDeck,
		{
			teleport: number;
			smallHealthPotion: number;
			mediumHealthPotion: number;
			largeHealthPotion: number;
			fullHealthPotion: number;
			extraHeart: number;
			chest: number;
		}
	>;
};

type Candidate = {
	genome: Genome;
	fitness: number;
	aggregate: AggregateResult;
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
	baseDeckDefinitionsPath: string;
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
		baseDeckDefinitionsPath:
			raw.baseDeckDefinitionsPath || raw.baseDeckPath || path.resolve(process.cwd(), '..', 'server', 'config', 'deck-definitions.json'),
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

function toCount(value: number): number {
	return Math.max(0, Math.round(value));
}

function clampChance(value: number): number {
	return clamp(Number(value.toFixed(4)), 0.05, 0.95);
}

function createBalanceConfigFromGenome(genome: Genome): BalanceJsonConfig {
	const weaponScale = clamp(genome.itemEncounterScale, 0.6, 1.8);
	const monsterScale = clamp(genome.monsterEncounterScale, 0.6, 1.8);
	const consumableScale = clamp(genome.consumableHealScale, 0.5, 2.0);

	const weakStrong = normalizeWeights({
		weak: genome.weakWeightScale,
		normal: 1,
		strong: genome.strongWeightScale,
	});

	const weakFactor = clamp(0.5 + weakStrong.weak, 0.6, 1.4);
	const strongFactor = clamp(0.5 + weakStrong.strong, 0.6, 1.4);

	const scaleWeapon = (minAttack: number, maxAttack: number, minChance: number, maxChance: number) => ({
		minAttack: Math.max(1, Math.round(minAttack * weaponScale)),
		maxAttack: Math.max(1, Math.round(maxAttack * weaponScale)),
		minChance: clampChance(minChance * clamp(0.9 + (weaponScale - 1) * 0.2, 0.75, 1.15)),
		maxChance: clampChance(maxChance * clamp(0.9 + (weaponScale - 1) * 0.2, 0.75, 1.15)),
	});

	const scaleArmor = (minDefense: number, maxDefense: number, minChance: number, maxChance: number) => ({
		minDefense: Math.max(1, Math.round(minDefense * weaponScale)),
		maxDefense: Math.max(1, Math.round(maxDefense * weaponScale)),
		minChance: clampChance(minChance * clamp(0.9 + (weaponScale - 1) * 0.2, 0.75, 1.15)),
		maxChance: clampChance(maxChance * clamp(0.9 + (weaponScale - 1) * 0.2, 0.75, 1.15)),
	});

	const scaleMonsterRange = (
		minHealth: number,
		maxHealth: number,
		minAttack: number,
		maxAttack: number,
		minAttackChance: number,
		maxAttackChance: number,
		minDefense: number,
		maxDefense: number,
		minDefenseChance: number,
		maxDefenseChance: number,
	) => ({
		minHealth: Math.max(1, Math.round(minHealth * monsterScale)),
		maxHealth: Math.max(1, Math.round(maxHealth * monsterScale)),
		minAttack: Math.max(1, Math.round(minAttack * monsterScale)),
		maxAttack: Math.max(1, Math.round(maxAttack * monsterScale)),
		minAttackChance: clampChance(minAttackChance * clamp(0.9 + (monsterScale - 1) * 0.2, 0.75, 1.15)),
		maxAttackChance: clampChance(maxAttackChance * clamp(0.9 + (monsterScale - 1) * 0.2, 0.75, 1.15)),
		minDefense: Math.max(0, Math.round(minDefense * monsterScale)),
		maxDefense: Math.max(0, Math.round(maxDefense * monsterScale)),
		minDefenseChance: clampChance(minDefenseChance * clamp(0.9 + (monsterScale - 1) * 0.2, 0.75, 1.15)),
		maxDefenseChance: clampChance(maxDefenseChance * clamp(0.9 + (monsterScale - 1) * 0.2, 0.75, 1.15)),
	});

	return {
		weapons: {
			forest: scaleWeapon(1, 4, 0.5, 0.6),
			desert: scaleWeapon(9, 12, 0.65, 0.75),
			volcano: scaleWeapon(14, 17, 0.75, 0.85),
		},
		armors: {
			forest: scaleArmor(4, 4, 0.603, 0.603),
			desert: scaleArmor(12, 12, 0.723, 0.723),
			volcano: scaleArmor(17, 17, 0.823, 0.823),
		},
		itemVariance: {
			cracked: { valueDelta: -1, chanceDelta: -0.0596 },
			normal: { valueDelta: 0, chanceDelta: 0 },
			enchanted: { valueDelta: 1, chanceDelta: 0.0596 },
		},
		consumables: {
			smallPotionHeal: Math.max(1, toCount(3 * consumableScale)),
			mediumPotionHeal: Math.max(1, toCount(5 * consumableScale)),
			largePotionHeal: Math.max(1, toCount(7 * consumableScale)),
		},
		itemConsumables: {
			forest: {
				teleport: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				smallHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				mediumHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				largeHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				fullHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				extraHeart: Math.max(0, toCount(1 * clamp(genome.lootHeartScale, 0, 3))),
			},
			desert: {
				teleport: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				smallHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				mediumHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				largeHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				fullHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				extraHeart: Math.max(0, toCount(1 * clamp(genome.lootHeartScale, 0, 3))),
			},
			volcano: {
				teleport: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				smallHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				mediumHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				largeHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				fullHealthPotion: Math.max(0, toCount(2 * clamp(genome.lootConsumableScale, 0, 3))),
				extraHeart: Math.max(0, toCount(1 * clamp(genome.lootHeartScale, 0, 3))),
			},
		},
		monsters: {
			forest: scaleMonsterRange(5, 7, 3, 5, 0.6098, 0.7098, 1, 3, 0.3098, 0.4098),
			desert: scaleMonsterRange(12, 16, 4, 6, 0.7298, 0.8298, 3, 5, 0.4498, 0.5498),
			volcano: scaleMonsterRange(23, 27, 7, 9, 0.8498, 0.93, 5, 7, 0.6098, 0.69),
		},
		monsterVariance: {
			weak: {
				healthDelta: -Math.max(1, Math.round(weakFactor)),
				attackDelta: -Math.max(1, Math.round(weakFactor)),
				attackChanceDelta: -Number((0.08 * weakFactor).toFixed(4)),
				defenseDelta: -Math.max(1, Math.round(weakFactor)),
				defenseChanceDelta: -Number((0.08 * weakFactor).toFixed(4)),
			},
			normal: { healthDelta: 0, attackDelta: 0, attackChanceDelta: 0, defenseDelta: 0, defenseChanceDelta: 0 },
			strong: {
				healthDelta: Math.max(1, Math.round(strongFactor)),
				attackDelta: Math.max(1, Math.round(strongFactor)),
				attackChanceDelta: Number((0.08 * strongFactor).toFixed(4)),
				defenseDelta: Math.max(1, Math.round(strongFactor)),
				defenseChanceDelta: Number((0.08 * strongFactor).toFixed(4)),
			},
		},
		monsterConsumables: {
			forest: {
				teleport: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				smallHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				mediumHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				largeHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				fullHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				extraHeart: Math.max(0, toCount(1 * clamp(genome.heartEncounterScale, 0, 3))),
				chest: Math.max(0, toCount(10 * clamp(genome.consumableEncounterScale, 0, 3))),
			},
			desert: {
				teleport: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				smallHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				mediumHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				largeHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				fullHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				extraHeart: Math.max(0, toCount(1 * clamp(genome.heartEncounterScale, 0, 3))),
				chest: Math.max(0, toCount(10 * clamp(genome.consumableEncounterScale, 0, 3))),
			},
			volcano: {
				teleport: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				smallHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				mediumHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				largeHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				fullHealthPotion: Math.max(0, toCount(2 * clamp(genome.consumableEncounterScale, 0, 3))),
				extraHeart: Math.max(0, toCount(1 * clamp(genome.heartEncounterScale, 0, 3))),
				chest: Math.max(0, toCount(10 * clamp(genome.consumableEncounterScale, 0, 3))),
			},
		},
	};
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
		consumableHealScale: maybeMutate(genome.consumableHealScale, 0.2, 0.4, 2.0),
	};
}

function getTsxBinPath(): string {
	return 'tsx';
}

async function runSimulationWorker(simOptions: SimOptions): Promise<WorkerSimulationResult> {
	const workerScript = path.resolve(process.cwd(), 'src', 'candidateSimulationWorker.ts');
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
		`--deckDefinitionsConfigPath=${simOptions.deckDefinitionsConfigPath || ''}`,
		`--balanceConfigPath=${simOptions.balanceConfigPath || ''}`,
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
	genome: Genome,
	args: Args,
	seedSuffix: string
): Promise<Candidate> {
	const _tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dragon-ga-'));

	try {
		const balanceConfig = createBalanceConfigFromGenome(genome);
		const balanceConfigPath = path.join(_tempDir, 'balance.json');
		await fs.writeFile(balanceConfigPath, JSON.stringify(balanceConfig, null, 2), 'utf8');

		const simOptions: SimOptions = {
			games: args.games,
			maxTurns: args.maxTurns,
			seed: `${args.seed}-${seedSuffix}`,
			gridSizeX: args.gridSizeX,
			gridSizeY: args.gridSizeY,
			playerName: 'AutoBalanceBot',
			deckDefinitionsConfigPath: args.baseDeckDefinitionsPath,
			balanceConfigPath,
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
		};
	} finally {
		await fs.rm(_tempDir, { recursive: true, force: true });
	}
}

async function evaluateCandidateWithRetry(
	genome: Genome,
	args: Args,
	seedSuffix: string
): Promise<Candidate> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await evaluateCandidate(genome, args, `${seedSuffix}-a${attempt}`);
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
		const evaluated = await evaluatePopulation(population, args, generation);
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

	const bestBalancePath = path.join(artifactDir, 'best-balance.json');
	await fs.writeFile(bestBalancePath, JSON.stringify(createBalanceConfigFromGenome(best.genome), null, 2), 'utf8');

	const bestDeckDefinitionsPath = args.baseDeckDefinitionsPath;

	const baselineSummary = await runApiSimulation(
		{
			games: args.games,
			maxTurns: args.maxTurns,
			seed: `${args.seed}-baseline`,
			gridSizeX: args.gridSizeX,
			gridSizeY: args.gridSizeY,
			playerName: 'AutoBalanceBot',
			deckDefinitionsConfigPath: args.baseDeckDefinitionsPath,
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
			deckDefinitionsConfigPath: bestDeckDefinitionsPath,
			balanceConfigPath: bestBalancePath,
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
			bestDeckDefinitionsPath,
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
