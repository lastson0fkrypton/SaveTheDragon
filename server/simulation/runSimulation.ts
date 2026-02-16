import { initDb } from '../db.js';
import path from 'node:path';
import vm from 'node:vm';
import {
	runBaselineVsCandidate,
	runSimulationBatch,
	type BalanceOverrideSet,
	type SimulationBatchProgress,
	type SimulationConfig,
} from './simulator.js';

function parseJsonArg<T>(value: string | undefined, fallback: T): T {
	if (!value) return fallback;
	const raw = value.trim();
	const candidates = [raw];
	if (
		(raw.startsWith('"') && raw.endsWith('"')) ||
		(raw.startsWith("'") && raw.endsWith("'"))
	) {
		candidates.push(raw.slice(1, -1));
	}

	for (const candidate of candidates) {
		try {
			return JSON.parse(candidate) as T;
		} catch (_error) {
			// Try a JS object literal fallback for shell-passed payloads like
			// {biomeEncounterRates:{plains:0.12,...}}
			try {
				const script = new vm.Script(`(${candidate})`);
				return script.runInNewContext(Object.create(null)) as T;
			} catch (_fallbackError) {
				// Continue trying next candidate
			}
		}
	}

	return fallback;
}

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

function formatDurationMs(ms: number): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes <= 0) return `${seconds}s`;
	return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

function logSimulationProgress(progress: SimulationBatchProgress): void {
	const etaText = progress.etaMs < 0 ? 'n/a' : formatDurationMs(progress.etaMs);
	console.error(
		`[simulate] ${progress.label} ${progress.completedRuns}/${progress.totalRuns} (${progress.percentComplete.toFixed(1)}%) active=${progress.activeRuns} rpm=${progress.runsPerMinute.toFixed(1)} eta=${etaText}`
	);
}

async function main() {
	initDb();
	const args = parseArgs(process.argv.slice(2));
	const seed = args.seed ?? 'std-seed';
	const artifactRoot = args.artifactDir || 'simulation-output';
	const runName = args.runName || `simulate-${seed}`;
	const artifactDir = path.join(artifactRoot, toSafeFolderName(runName));
	const config: Partial<SimulationConfig> = {
		seed,
		runs: args.runs ? Number(args.runs) : 100,
		parallelism: args.parallelism ? Number(args.parallelism) : 6,
		playersPerGame: args.playersPerGame ? Number(args.playersPerGame) : 3,
		turnCap: args.turnCap ? Number(args.turnCap) : 150,
		behaviorProfileWeights: parseJsonArg(args.behaviors, {
			'risk-averse': 0.34,
			aggressive: 0.33,
			completionist: 0.33,
		}),
		output: {
			artifactDir,
			writePerGameLogs: args.writePerGameLogs === 'true',
			writeTextReport: args.writeTextReport === 'true',
			textReportFileName: args.textReportFileName,
		},
	};

	console.error(`[simulate] runName=${runName} artifactDir=${artifactDir}`);

	const candidateOverrides = parseJsonArg<BalanceOverrideSet | null>(args.candidate, null);
	const compareMode = args.compare === 'true';

	if (compareMode && candidateOverrides) {
		const comparison = await runBaselineVsCandidate(config, candidateOverrides);
		console.log(JSON.stringify(comparison, null, 2));
		process.exit(0);
	}

	const batch = await runSimulationBatch(config, candidateOverrides, undefined, {
		label: runName,
		progressEvery: args.progressEvery ? Number(args.progressEvery) : undefined,
		onProgress: logSimulationProgress,
	});
	console.log(JSON.stringify(batch, null, 2));
}

main().catch(error => {
	console.error('Simulation runner failed:', error);
	process.exit(1);
});
