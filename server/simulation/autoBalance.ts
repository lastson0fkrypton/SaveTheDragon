import { initDb } from '../db.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSeededRandom } from '../utils/random.js';
import {
	buildScaledBaselineOverrides,
	runSimulationBatch,
	type BalanceOverrideSet,
	type SimulationBatchProgress,
	type SimulationBatchSummary,
	type SimulationConfig,
} from './simulator.js';

type Genome = {
	monsterBaseScale: number;
	monsterVariantScale: number;
	itemBaseScale: number;
	itemVariantScale: number;
	encounterRateScale: number;
	chanceDelta: number;
	healthItemDropScale: number;
	extraHeartDropScale: number;
};

type CandidateResult = {
	genome: Genome;
	overrides: BalanceOverrideSet;
	summary: SimulationBatchSummary;
	fitness: number;
};

function parseArgs(argv: string[]): Record<string, string> {
	const args: Record<string, string> = {};
	for (const raw of argv) {
		if (!raw.startsWith('--')) continue;
		const [key, ...rest] = raw.slice(2).split('=');
		args[key] = rest.length > 0 ? rest.join('=') : 'true';
	}
	return args;
}

function toSafeFolderName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-_]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '') || 'run';
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function formatDurationMs(ms: number): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes <= 0) return `${seconds}s`;
	return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function buildProgressLogger(prefix: string, progressFilePath?: string) {
	return (progress: SimulationBatchProgress) => {
		const etaText = progress.etaMs < 0 ? 'n/a' : formatDurationMs(progress.etaMs);
		if (progressFilePath) {
			void fs.writeFile(progressFilePath, JSON.stringify(progress, null, 2), 'utf-8');
		}
		console.error(
			`[autobalance] ${prefix} ${progress.completedRuns}/${progress.totalRuns} (${progress.percentComplete.toFixed(1)}%) active=${progress.activeRuns} rpm=${progress.runsPerMinute.toFixed(1)} eta=${etaText}`
		);
	};
}

function buildRandomGenome(rand: () => number): Genome {
	return {
		monsterBaseScale: 0.75 + rand() * 0.7,
		monsterVariantScale: 0.7 + rand() * 0.8,
		itemBaseScale: 0.75 + rand() * 0.7,
		itemVariantScale: 0.7 + rand() * 0.8,
		encounterRateScale: 0.75 + rand() * 0.6,
		chanceDelta: -0.12 + rand() * 0.24,
		healthItemDropScale: 0.75 + rand() * 1.5,
		extraHeartDropScale: 0.75 + rand() * 1.75,
	};
}

function crossover(parentA: Genome, parentB: Genome, rand: () => number): Genome {
	const mix = (a: number, b: number) => a * (1 - rand()) + b * rand();
	return {
		monsterBaseScale: mix(parentA.monsterBaseScale, parentB.monsterBaseScale),
		monsterVariantScale: mix(parentA.monsterVariantScale, parentB.monsterVariantScale),
		itemBaseScale: mix(parentA.itemBaseScale, parentB.itemBaseScale),
		itemVariantScale: mix(parentA.itemVariantScale, parentB.itemVariantScale),
		encounterRateScale: mix(parentA.encounterRateScale, parentB.encounterRateScale),
		chanceDelta: mix(parentA.chanceDelta, parentB.chanceDelta),
		healthItemDropScale: mix(parentA.healthItemDropScale, parentB.healthItemDropScale),
		extraHeartDropScale: mix(parentA.extraHeartDropScale, parentB.extraHeartDropScale),
	};
}

function mutate(genome: Genome, mutationRate: number, rand: () => number): Genome {
	const maybeMutate = (value: number, span: number, min: number, max: number) => {
		if (rand() > mutationRate) return value;
		const delta = (rand() * 2 - 1) * span;
		return clamp(value + delta, min, max);
	};
	return {
		monsterBaseScale: maybeMutate(genome.monsterBaseScale, 0.2, 0.4, 1.8),
		monsterVariantScale: maybeMutate(genome.monsterVariantScale, 0.25, 0.3, 2),
		itemBaseScale: maybeMutate(genome.itemBaseScale, 0.2, 0.4, 1.8),
		itemVariantScale: maybeMutate(genome.itemVariantScale, 0.25, 0.3, 2),
		encounterRateScale: maybeMutate(genome.encounterRateScale, 0.15, 0.5, 1.5),
		chanceDelta: maybeMutate(genome.chanceDelta, 0.05, -0.25, 0.25),
		healthItemDropScale: maybeMutate(genome.healthItemDropScale, 0.25, 0.4, 3),
		extraHeartDropScale: maybeMutate(genome.extraHeartDropScale, 0.3, 0.4, 3.5),
	};
}

function genomeToOverrides(genome: Genome): BalanceOverrideSet {
	return buildScaledBaselineOverrides(genome);
}

function evaluateFitness(summary: SimulationBatchSummary): number {
	const targetRatio = 2;
	const ratioPenalty = Math.abs(summary.winLossRatio - targetRatio) / targetRatio;
	const beatablePenalty = Math.max(0, 0.65 - summary.beatableRate) * 2.5;
	const timeoutPenalty = Math.max(0, summary.timeoutRate - 0.25) * 3;
	const winPenalty = Math.max(0, 0.55 - summary.winRate) * 1.5;
	const earlyLossPenalty = summary.earlyLossFrequency * 1.2;
	const failPenalty =
		(summary.failSignals.beatableRateDropped ? 0.7 : 0) +
		(summary.failSignals.timeoutRateTooHigh ? 0.7 : 0) +
		(summary.failSignals.winLossRatioOutsideBand ? 0.5 : 0);

	return Number((1 - (ratioPenalty + beatablePenalty + timeoutPenalty + winPenalty + earlyLossPenalty + failPenalty)).toFixed(6));
}

async function evaluateCandidate(
	config: Partial<SimulationConfig>,
	seedPrefix: string,
	index: number,
	genome: Genome,
	baselineSummary: SimulationBatchSummary,
	progress?: {
		label?: string;
		progressEveryRuns?: number;
		progressFilePath?: string;
	}
): Promise<CandidateResult> {
	const overrides = genomeToOverrides(genome);
	const result = await runSimulationBatch(
		{
			...config,
			seed: `${seedPrefix}-cand-${index}`,
		},
		overrides,
		baselineSummary,
		{
			label: progress?.label,
			progressEvery: progress?.progressEveryRuns,
			onProgress: progress?.label ? buildProgressLogger(progress.label, progress.progressFilePath) : undefined,
		}
	);
	return {
		genome,
		overrides,
		summary: result.summary,
		fitness: evaluateFitness(result.summary),
	};
}

async function main() {
	initDb();
	const args = parseArgs(process.argv.slice(2));
	const seed = args.seed ?? 'auto-balance-seed';
	const startedAt = Date.now();
	const artifactRoot = args.artifactDir || 'simulation-output';
	const runName = args.runName || `autobalance-${seed}`;
	const artifactDir = path.join(artifactRoot, toSafeFolderName(runName));
	const rand = createSeededRandom(seed);
	const generations = Math.max(1, Number(args.generations ?? 6));
	const populationSize = Math.max(4, Number(args.population ?? 12));
	const eliteCount = Math.max(1, Math.min(populationSize - 1, Number(args.elite ?? 3)));
	const candidateParallelism = Math.max(1, Math.min(populationSize, Number(args.candidateParallelism ?? 2)));
	const progressEveryRuns = Math.max(1, Number(args.progressEveryRuns ?? Math.max(5, Math.floor((Number(args.runs ?? 80) || 80) / 10))));
	const mutationRate = clamp(Number(args.mutationRate ?? 0.28), 0.01, 0.95);
	const config: Partial<SimulationConfig> = {
		seed,
		runs: Math.max(10, Number(args.runs ?? 80)),
		parallelism: Math.max(1, Number(args.parallelism ?? 6)),
		playersPerGame: Math.max(1, Number(args.playersPerGame ?? 3)),
		turnCap: Math.max(20, Number(args.turnCap ?? 150)),
		behaviorProfileWeights: {
			'risk-averse': 0.34,
			aggressive: 0.33,
			completionist: 0.33,
		},
		output: undefined,
	};

	console.error(
		`[autobalance] seed=${seed} generations=${generations} population=${populationSize} runs=${config.runs} parallelism=${config.parallelism} candidateParallelism=${candidateParallelism}`
	);
	console.error(`[autobalance] runName=${runName} writing artifacts to ${artifactDir}`);
	await fs.mkdir(artifactDir, { recursive: true });

	const baseline = await runSimulationBatch(
		{
			...config,
			seed: `${seed}-baseline`,
			output: {
				artifactDir,
				writePerGameLogs: false,
				writeTextReport: true,
				textReportFileName: `autobalance-${seed}-baseline-report.txt`,
			},
		},
		null,
		undefined,
		{
			label: `${runName}:baseline`,
			progressEvery: progressEveryRuns,
			onProgress: buildProgressLogger(
				`${runName}:baseline`,
				path.join(artifactDir, `progress-${toSafeFolderName(`${runName}-baseline`)}.json`)
			),
		}
	);
	console.error(
		`[autobalance] baseline complete | winRate=${(baseline.summary.winRate * 100).toFixed(2)}% | beatableRate=${(baseline.summary.beatableRate * 100).toFixed(2)}% | timeoutRate=${(baseline.summary.timeoutRate * 100).toFixed(2)}%`
	);
	let population: Genome[] = Array.from({ length: populationSize }, () => buildRandomGenome(rand));
	let bestCandidate: CandidateResult | null = null;
	const history: Array<{ generation: number; bestFitness: number; bestSummary: SimulationBatchSummary }> = [];

	for (let generation = 0; generation < generations; generation += 1) {
		console.error(`[autobalance] generation ${generation + 1}/${generations} started`);
		const evaluations: CandidateResult[] = new Array(population.length);
		let nextCandidateIndex = 0;
		const generationWorkers = Array.from({ length: Math.min(candidateParallelism, population.length) }, async () => {
			while (true) {
				const index = nextCandidateIndex;
				nextCandidateIndex += 1;
				if (index >= population.length) break;
				const genome = population[index];
				console.error(`[autobalance] generation ${generation + 1}/${generations} candidate ${index + 1}/${population.length} started`);
				const evaluated = await evaluateCandidate(config, `${seed}-g${generation}`, index, genome, baseline.summary, {
					label: `${runName}:g${generation + 1}:c${index + 1}`,
					progressEveryRuns,
					progressFilePath: path.join(
						artifactDir,
						`progress-${toSafeFolderName(`${runName}-g${generation + 1}-c${index + 1}`)}.json`
					),
				});
				evaluations[index] = evaluated;
				console.error(
					`[autobalance] generation ${generation + 1}/${generations} candidate ${index + 1}/${population.length} fitness=${evaluated.fitness.toFixed(4)} winRate=${(evaluated.summary.winRate * 100).toFixed(2)}% beatable=${(evaluated.summary.beatableRate * 100).toFixed(2)}% timeout=${(evaluated.summary.timeoutRate * 100).toFixed(2)}%`
				);
			}
		});

		await Promise.all(generationWorkers);
		evaluations.sort((left, right) => right.fitness - left.fitness);
		const generationBest = evaluations[0];
		if (!bestCandidate || generationBest.fitness > bestCandidate.fitness) {
			bestCandidate = generationBest;
		}

		history.push({
			generation,
			bestFitness: generationBest.fitness,
			bestSummary: generationBest.summary,
		});
		console.error(
			`[autobalance] generation ${generation + 1}/${generations} best fitness=${generationBest.fitness.toFixed(4)} winRate=${(generationBest.summary.winRate * 100).toFixed(2)}% beatable=${(generationBest.summary.beatableRate * 100).toFixed(2)}% timeout=${(generationBest.summary.timeoutRate * 100).toFixed(2)}%`
		);

		const nextPopulation: Genome[] = evaluations.slice(0, eliteCount).map(entry => entry.genome);
		while (nextPopulation.length < populationSize) {
			const parentA = evaluations[Math.floor(rand() * Math.min(6, evaluations.length))].genome;
			const parentB = evaluations[Math.floor(rand() * Math.min(6, evaluations.length))].genome;
			const child = mutate(crossover(parentA, parentB, rand), mutationRate, rand);
			nextPopulation.push(child);
		}
		population = nextPopulation;
	}

	if (!bestCandidate) {
		throw new Error('Auto-balancer failed to evaluate candidates');
	}

	const reportRuns = Math.max(10, Math.min(Number(args.reportRuns ?? config.runs ?? 80), Number(config.runs ?? 80)));
	console.error(`[autobalance] running detailed best-candidate report batch (runs=${reportRuns})`);
	const bestCandidateDetailed = await runSimulationBatch(
		{
			...config,
			seed: `${seed}-best-report`,
			runs: reportRuns,
			output: {
				artifactDir,
				writePerGameLogs: true,
				writeTextReport: true,
				textReportFileName: `autobalance-${seed}-best-candidate-report.txt`,
			},
		},
		bestCandidate.overrides,
		baseline.summary,
		{
			label: `${runName}:best-candidate-report`,
			progressEvery: progressEveryRuns,
			onProgress: buildProgressLogger(
				`${runName}:best-candidate-report`,
				path.join(artifactDir, `progress-${toSafeFolderName(`${runName}-best-candidate-report`)}.json`)
			),
		}
	);

	const output = {
		meta: {
			seed,
			generations,
			populationSize,
			candidateParallelism,
			eliteCount,
			mutationRate,
			reportRuns,
			durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
		},
		baselineSummary: baseline.summary,
		bestCandidateDetailedSummary: bestCandidateDetailed.summary,
		bestCandidate: {
			fitness: bestCandidate.fitness,
			summary: bestCandidate.summary,
			overrides: bestCandidate.overrides,
			genome: bestCandidate.genome,
		},
		history,
		reportArtifacts: {
			baselineTextReport: path.join(artifactDir, `autobalance-${seed}-baseline-report.txt`),
			bestCandidateTextReport: path.join(artifactDir, `autobalance-${seed}-best-candidate-report.txt`),
			note: 'Per-game quest-log JSON is written as games-<timestamp>.json in artifactDir.',
		},
		recommendation: {
			applyOverrides: bestCandidate.overrides,
			notes: [
				'Candidate targets beatable rate and timeout limits while steering win/loss ratio toward 2:1.',
				'Re-run baseline vs candidate with higher runs for confidence before applying to live constants.',
			],
		},
	};

	const finalJsonPath = path.join(artifactDir, `autobalance-${seed}-result.json`);
	await fs.writeFile(finalJsonPath, JSON.stringify(output, null, 2), 'utf-8');
	console.error(`[autobalance] complete in ${output.meta.durationSeconds}s | result written: ${finalJsonPath}`);

	console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
	console.error('Auto-balancer failed:', error);
	process.exit(1);
});
