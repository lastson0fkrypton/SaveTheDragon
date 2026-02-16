import fs from 'node:fs/promises';
import path from 'node:path';
import {
	applyBiomeEncounterRateOverrides,
	getBiomeEncounterRates,
	resetBiomeEncounterRates,
	type BiomeEncounterRates,
} from '../constants/biomes.js';
import {
	DEFAULT_ITEM_BALANCE_PROFILE,
	applyItemBalanceProfile,
	resetItemBalanceProfile,
	type ItemBalanceProfileOverride,
} from '../constants/items.js';
import {
	DEFAULT_MONSTER_BALANCE_PROFILE,
	applyMonsterBalanceProfile,
	resetMonsterBalanceProfile,
	type MonsterBalanceProfileOverride,
} from '../constants/monsters.js';
import { clearGameDataById } from '../repositories/gameRepository.js';
import { attackBattle, collectBattleLoot, returnPlayerToTown, runFromBattle } from '../services/battleService.js';
import { createNewGame, joinExistingGame, loadSerializedGame, movePlayerToTarget, rollDiceForPlayer } from '../services/gameService.js';
import { equipItem, useItem } from '../services/playerService.js';
import { createSeededRandom, withRandomProvider } from '../utils/random.js';

export type SimulationBehavior = 'risk-averse' | 'aggressive' | 'completionist';

export type BalanceOverrideSet = {
	biomeEncounterRates?: Partial<BiomeEncounterRates>;
	item?: ItemBalanceProfileOverride;
	monster?: MonsterBalanceProfileOverride;
};

export type SimulationConfig = {
	seed: string;
	runs: number;
	parallelism: number;
	playersPerGame: number;
	turnCap: number;
	behaviorProfileWeights: Partial<Record<SimulationBehavior, number>>;
	output?: {
		artifactDir?: string;
		writePerGameLogs?: boolean;
		writeTextReport?: boolean;
		textReportFileName?: string;
		captureQuestLog?: boolean;
	};
	thresholds?: {
		maxTimeoutRate?: number;
		minBeatableRate?: number;
		winLossRatioBand?: { min: number; max: number };
		beatableRateRegressionSlack?: number;
	};
	lossCap?: number;
	earlyLossTurnThreshold?: number;
};

export type SimulationOutcome = 'win' | 'loss' | 'timeout' | 'aborted';

export type PerGameSimulationLog = {
	runIndex: number;
	seed: string;
	players: Array<{ playerId: string; playerName: string; behavior: SimulationBehavior }>;
	outcome: SimulationOutcome;
	turnsPlayed: number;
	battlesWon: number;
	battlesLost: number;
	encounterCount: number;
	avgTurnsBetweenEncounters: number;
	longestWinStreak: number;
	longestLoseStreak: number;
	turnsToOutcome: number;
	earlyLoss: boolean;
	timedOut: boolean;
	beatable: boolean;
	biomeVisitCounts: Record<string, number>;
	biomeProgressionCadence: Record<string, number | null>;
	questLog: string[];
	errors: string[];
};

export type ProfileBreakdown = {
	games: number;
	winRate: number;
	lossRate: number;
	timeoutRate: number;
	abortedRate: number;
	beatableRate: number;
};

export type SimulationBatchSummary = {
	seed: string;
	runs: number;
	parallelism: number;
	playersPerGame: number;
	turnCap: number;
	winRate: number;
	lossRate: number;
	timeoutRate: number;
	abortedRate: number;
	winLossRatio: number;
	beatableRate: number;
	encounters: number;
	avgTurnsBetweenEncounters: number;
	turnsToOutcomePercentiles: { p50: number; p90: number; p95: number };
	earlyLossFrequency: number;
	timeoutFrequency: number;
	profileBreakdown: Record<SimulationBehavior, ProfileBreakdown>;
	failSignals: {
		beatableRateDropped: boolean;
		timeoutRateTooHigh: boolean;
		winLossRatioOutsideBand: boolean;
	};
};

export type SimulationBatchResult = {
	config: SimulationConfig;
	appliedOverrides: BalanceOverrideSet | null;
	summary: SimulationBatchSummary;
	perGame: PerGameSimulationLog[];
	textReport?: string;
};

export type SimulationBatchProgress = {
	label: string;
	completedRuns: number;
	totalRuns: number;
	activeRuns: number;
	percentComplete: number;
	elapsedMs: number;
	etaMs: number;
	runsPerMinute: number;
};

type RunSimulationBatchOptions = {
	label?: string;
	progressEvery?: number;
	progressMinIntervalMs?: number;
	onProgress?: (progress: SimulationBatchProgress) => void;
};

type RuntimePlayer = {
	id: string;
	name: string;
	damage: number;
	maxHearts: number;
	positionX: number;
	positionY: number;
};

type RuntimeInventoryItem = {
	id: string;
	name?: string;
	type?: 'weapon' | 'armor' | 'item';
	heal?: number | null;
	effect?: string | null;
	attack?: number | null;
	attackChance?: number | null;
	defense?: number | null;
	defenseChance?: number | null;
};

const ALL_BEHAVIORS: SimulationBehavior[] = ['risk-averse', 'aggressive', 'completionist'];

function clampRate(value: number): number {
	return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

function normalizeConfig(input: Partial<SimulationConfig>): SimulationConfig {
	const seed = String(input.seed ?? 'std-seed');
	return {
		seed,
		runs: Math.max(1, Math.floor(input.runs ?? 50)),
		parallelism: Math.max(1, Math.floor(input.parallelism ?? 4)),
		playersPerGame: Math.max(1, Math.floor(input.playersPerGame ?? 3)),
		turnCap: Math.max(10, Math.floor(input.turnCap ?? 150)),
		behaviorProfileWeights: input.behaviorProfileWeights ?? {
			'risk-averse': 0.34,
			aggressive: 0.33,
			completionist: 0.33,
		},
		output: input.output,
		thresholds: {
			maxTimeoutRate: input.thresholds?.maxTimeoutRate ?? 0.35,
			minBeatableRate: input.thresholds?.minBeatableRate ?? 0.5,
			winLossRatioBand: input.thresholds?.winLossRatioBand ?? { min: 1.5, max: 2.5 },
			beatableRateRegressionSlack: input.thresholds?.beatableRateRegressionSlack ?? 0.05,
		},
		lossCap: Math.max(2, Math.floor(input.lossCap ?? (input.playersPerGame || 3) * 6)),
		earlyLossTurnThreshold: Math.max(5, Math.floor(input.earlyLossTurnThreshold ?? 20)),
	};
}

function chooseBehavior(weightMap: Partial<Record<SimulationBehavior, number>>, pick: number): SimulationBehavior {
	const weights = ALL_BEHAVIORS.map(behavior => ({
		behavior,
		weight: Math.max(0, weightMap[behavior] ?? 0),
	}));
	const total = weights.reduce((sum, item) => sum + item.weight, 0);
	if (total <= 0) {
		return ALL_BEHAVIORS[Math.floor(pick * ALL_BEHAVIORS.length)] ?? 'aggressive';
	}
	let remaining = pick * total;
	for (const item of weights) {
		remaining -= item.weight;
		if (remaining <= 0) {
			return item.behavior;
		}
	}
	return 'completionist';
}

function biomeTier(biome: string): number {
	if (biome === 'plains') return 1;
	if (biome === 'forest') return 2;
	if (biome === 'desert') return 3;
	if (biome === 'cave' || biome === 'volcano') return 4;
	if (biome === 'castle') return 5;
	return 0;
}

function nearestBiomeDistance(grid: string[][], startX: number, startY: number, targetBiome: string): number {
	let minDistance = Number.POSITIVE_INFINITY;
	for (let y = 0; y < grid.length; y += 1) {
		for (let x = 0; x < grid[0].length; x += 1) {
			if (grid[y][x] !== targetBiome) continue;
			const distance = Math.abs(startX - x) + Math.abs(startY - y);
			if (distance < minDistance) {
				minDistance = distance;
			}
		}
	}
	return Number.isFinite(minDistance) ? minDistance : 999;
}

function chooseMoveForBehavior(
	profile: SimulationBehavior,
	validMoves: Array<{ x: number; y: number }>,
	player: RuntimePlayer,
	state: any,
	seenBiomes: Set<string>
): { x: number; y: number } {
	const grid = state.biomeGrid as string[][];
	let bestMove = validMoves[0];
	let bestScore = Number.NEGATIVE_INFINITY;
	const health = Math.max(0, (player.maxHearts || 5) - (player.damage || 0));

	for (const move of validMoves) {
		const biome = grid[move.y]?.[move.x] || 'plains';
		const tier = biomeTier(biome);
		const distToCastle = nearestBiomeDistance(grid, move.x, move.y, 'castle');
		const distToTown = nearestBiomeDistance(grid, move.x, move.y, 'town');
		const isNewBiome = !seenBiomes.has(biome);
		let score = 0;

		if (profile === 'aggressive') {
			score = tier * 2.5 - distToCastle * 0.25 - distToTown * 0.05;
			if (biome === 'castle') score += 4;
			if (health <= 2 && biome === 'town') score += 2;
		}

		if (profile === 'risk-averse') {
			score = -tier * 2 - distToTown * 0.05;
			if (biome === 'town') score += 6;
			if (biome === 'plains' || biome === 'forest') score += 2;
			if (health <= 2) score += biome === 'town' ? 4 : -2;
		}

		if (profile === 'completionist') {
			score = tier * 1.6 - distToCastle * 0.18;
			if (isNewBiome) score += 2.5;
			if (biome === 'castle') score += 3;
			if (health <= 1 && biome !== 'town') score -= 2;
		}

		if (score > bestScore) {
			bestScore = score;
			bestMove = move;
		}
	}

	return bestMove;
}

function chooseBattleAction(profile: SimulationBehavior, currentHealth: number, maxHealth: number, isRaidBoss: boolean): 'attack' | 'run' {
	const healthPct = maxHealth > 0 ? currentHealth / maxHealth : 0;
	if (profile === 'aggressive') {
		if (!isRaidBoss && healthPct < 0.18) return 'run';
		return 'attack';
	}
	if (profile === 'risk-averse') {
		if (healthPct < 0.45) return 'run';
		if (isRaidBoss && healthPct < 0.65) return 'run';
		return 'attack';
	}
	if (healthPct < 0.25 && !isRaidBoss) return 'run';
	return 'attack';
}

function safeMean(values: number[]): number {
	if (!values.length) return 0;
	return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function percentile(values: number[], ratio: number): number {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
	return sorted[index];
}

function summarizeBatch(
	config: SimulationConfig,
	logs: PerGameSimulationLog[],
	baselineSummary?: SimulationBatchSummary
): SimulationBatchSummary {
	const runs = logs.length || 1;
	const wins = logs.filter(log => log.outcome === 'win').length;
	const losses = logs.filter(log => log.outcome === 'loss').length;
	const timeouts = logs.filter(log => log.outcome === 'timeout').length;
	const aborted = logs.filter(log => log.outcome === 'aborted').length;
	const beatable = logs.filter(log => log.beatable).length;
	const encounters = logs.reduce((sum, log) => sum + log.encounterCount, 0);
	const avgTurnsBetweenEncounters = safeMean(
		logs
			.map(log => log.avgTurnsBetweenEncounters)
			.filter(value => Number.isFinite(value) && value >= 0)
	);
	const turnsToOutcomeValues = logs.map(log => log.turnsToOutcome);
	const earlyLosses = logs.filter(log => log.earlyLoss).length;
	const timeoutFrequency = timeouts / runs;
	const effectiveLosses = losses + timeouts;
	const winLossRatio = wins / Math.max(1, effectiveLosses);

	const profileBreakdown = ALL_BEHAVIORS.reduce(
		(acc, behavior) => {
			const profileLogs = logs.filter(log => log.players.some(player => player.behavior === behavior));
			const total = profileLogs.length || 1;
			acc[behavior] = {
				games: profileLogs.length,
				winRate: profileLogs.filter(log => log.outcome === 'win').length / total,
				lossRate: profileLogs.filter(log => log.outcome === 'loss').length / total,
				timeoutRate: profileLogs.filter(log => log.outcome === 'timeout').length / total,
				abortedRate: profileLogs.filter(log => log.outcome === 'aborted').length / total,
				beatableRate: profileLogs.filter(log => log.beatable).length / total,
			};
			return acc;
		},
		{} as Record<SimulationBehavior, ProfileBreakdown>
	);

	const beatableRate = beatable / runs;
	const timeoutRate = timeouts / runs;
	const band = config.thresholds?.winLossRatioBand ?? { min: 1.5, max: 2.5 };
	const minBeatableRate = config.thresholds?.minBeatableRate ?? 0.5;
	const beatableSlack = config.thresholds?.beatableRateRegressionSlack ?? 0.05;
	const baselineBeatableRate = baselineSummary?.beatableRate ?? minBeatableRate;
	const beatableThreshold = Math.max(minBeatableRate, baselineBeatableRate - beatableSlack);

	return {
		seed: config.seed,
		runs: config.runs,
		parallelism: config.parallelism,
		playersPerGame: config.playersPerGame,
		turnCap: config.turnCap,
		winRate: wins / runs,
		lossRate: losses / runs,
		timeoutRate,
		abortedRate: aborted / runs,
		winLossRatio: Number(winLossRatio.toFixed(4)),
		beatableRate,
		encounters,
		avgTurnsBetweenEncounters,
		turnsToOutcomePercentiles: {
			p50: percentile(turnsToOutcomeValues, 0.5),
			p90: percentile(turnsToOutcomeValues, 0.9),
			p95: percentile(turnsToOutcomeValues, 0.95),
		},
		earlyLossFrequency: earlyLosses / runs,
		timeoutFrequency,
		profileBreakdown,
		failSignals: {
			beatableRateDropped: beatableRate < beatableThreshold,
			timeoutRateTooHigh: timeoutRate > (config.thresholds?.maxTimeoutRate ?? 0.35),
			winLossRatioOutsideBand: winLossRatio < band.min || winLossRatio > band.max,
		},
	};
}

function applyBalanceOverrides(overrides: BalanceOverrideSet | null): void {
	resetBiomeEncounterRates();
	resetItemBalanceProfile();
	resetMonsterBalanceProfile();
	if (!overrides) return;
	if (overrides.biomeEncounterRates) {
		applyBiomeEncounterRateOverrides(overrides.biomeEncounterRates);
	}
	if (overrides.item) {
		applyItemBalanceProfile(overrides.item);
	}
	if (overrides.monster) {
		applyMonsterBalanceProfile(overrides.monster);
	}
}

function generateRunSeed(baseSeed: string, runIndex: number): string {
	return `${baseSeed}::run-${runIndex}`;
}

function formatPercent(value: number): string {
	return `${(value * 100).toFixed(2)}%`;
}

function renderSingleGameReport(game: PerGameSimulationLog): string {
	const lines: string[] = [];
	lines.push(`Game #${game.runIndex + 1} (${game.seed})`);
	lines.push(`Outcome: ${game.outcome}`);
	lines.push(
		`Results: turns=${game.turnsPlayed}, battlesWon=${game.battlesWon}, battlesLost=${game.battlesLost}, encounters=${game.encounterCount}, avgTurnsBetweenEncounters=${game.avgTurnsBetweenEncounters}`
	);
	lines.push(
		`Streaks: longestWinStreak=${game.longestWinStreak}, longestLoseStreak=${game.longestLoseStreak}, earlyLoss=${game.earlyLoss}, timedOut=${game.timedOut}, beatable=${game.beatable}`
	);
	lines.push(
		`Players: ${game.players.map(player => `${player.playerName} (${player.behavior})`).join(', ')}`
	);
	lines.push('----------------------------------------');
	lines.push('Game Quest Log');
	if (game.questLog.length === 0) {
		lines.push('- (no quest log events captured)');
	} else {
		for (const eventLine of game.questLog) {
			lines.push(`- ${eventLine}`);
		}
	}
	if (game.errors.length > 0) {
		lines.push('Errors:');
		for (const errorLine of game.errors) {
			lines.push(`- ${errorLine}`);
		}
	}
	return lines.join('\n');
}

function renderBatchTextReport(result: SimulationBatchResult): string {
	const { config, summary, appliedOverrides } = result;
	const lines: string[] = [];
	lines.push('Simulation Details');
	lines.push(`seed: ${config.seed}`);
	lines.push(
		`runs: ${config.runs}, parallelism: ${config.parallelism}, playersPerGame: ${config.playersPerGame}, turnCap: ${config.turnCap}`
	);
	lines.push(`behaviorWeights: ${JSON.stringify(config.behaviorProfileWeights)}`);
	lines.push(`appliedOverrides: ${appliedOverrides ? JSON.stringify(appliedOverrides) : 'none'}`);
	lines.push('');
	lines.push('Game Results');
	lines.push(
		`winRate=${formatPercent(summary.winRate)}, lossRate=${formatPercent(summary.lossRate)}, timeoutRate=${formatPercent(summary.timeoutRate)}, abortedRate=${formatPercent(summary.abortedRate)}, beatableRate=${formatPercent(summary.beatableRate)}, winLossRatio=${summary.winLossRatio}`
	);
	lines.push(
		`encounters=${summary.encounters}, avgTurnsBetweenEncounters=${summary.avgTurnsBetweenEncounters}, earlyLossFrequency=${formatPercent(summary.earlyLossFrequency)}, timeoutFrequency=${formatPercent(summary.timeoutFrequency)}`
	);
	lines.push(
		`turnsToOutcomePercentiles: p50=${summary.turnsToOutcomePercentiles.p50}, p90=${summary.turnsToOutcomePercentiles.p90}, p95=${summary.turnsToOutcomePercentiles.p95}`
	);
	lines.push(
		`failSignals: beatableRateDropped=${summary.failSignals.beatableRateDropped}, timeoutRateTooHigh=${summary.failSignals.timeoutRateTooHigh}, winLossRatioOutsideBand=${summary.failSignals.winLossRatioOutsideBand}`
	);
	lines.push('========================================');

	for (const game of result.perGame) {
		lines.push(renderSingleGameReport(game));
		lines.push('========================================');
	}

	return lines.join('\n');
}

async function maybeWriteArtifacts(result: SimulationBatchResult): Promise<void> {
	const artifactDir = result.config.output?.artifactDir;
	if (!artifactDir) return;
	await fs.mkdir(artifactDir, { recursive: true });

	const stamp = `${Date.now()}`;
	const summaryPath = path.join(artifactDir, `summary-${stamp}.json`);
	await fs.writeFile(summaryPath, JSON.stringify({ summary: result.summary, config: result.config }, null, 2), 'utf-8');

	if (result.config.output?.writePerGameLogs) {
		const gamePath = path.join(artifactDir, `games-${stamp}.json`);
		await fs.writeFile(gamePath, JSON.stringify(result.perGame, null, 2), 'utf-8');
	}

	if (result.config.output?.writeTextReport) {
		const reportFileName = result.config.output.textReportFileName || `simulation-report-${stamp}.txt`;
		const reportPath = path.join(artifactDir, reportFileName);
		const reportText = result.textReport || renderBatchTextReport(result);
		await fs.writeFile(reportPath, reportText, 'utf-8');
	}
}

function extractRuntimePlayer(state: any, playerId: string): RuntimePlayer | null {
	const player = (state.players || []).find((entry: any) => entry.id === playerId);
	if (!player) return null;
	return {
		id: player.id,
		name: player.name,
		damage: player.damage || 0,
		maxHearts: player.maxHearts || 5,
		positionX: player.positionX || 0,
		positionY: player.positionY || 0,
	};
}

function getPlayerEntry(state: any, playerId: string): any | null {
	return (state.players || []).find((entry: any) => entry.id === playerId) || null;
}

function getItemFromState(state: any, itemId?: string | null): RuntimeInventoryItem | null {
	if (!itemId) {
		return null;
	}
	const item = state.itemMeta?.[itemId];
	if (!item) {
		return null;
	}
	return item as RuntimeInventoryItem;
}

function shouldEquipWeaponUpgrade(candidate: RuntimeInventoryItem | null, equipped: RuntimeInventoryItem | null): boolean {
	if (!candidate?.id) return false;
	if (!equipped?.id) return true;

	const candidateAttack = candidate.attack ?? 0;
	const equippedAttack = equipped.attack ?? 0;
	if (candidateAttack > equippedAttack) return true;
	if (candidateAttack < equippedAttack) return false;

	const candidateChance = candidate.attackChance ?? 0;
	const equippedChance = equipped.attackChance ?? 0;
	return candidateChance > equippedChance;
}

function shouldEquipArmorUpgrade(candidate: RuntimeInventoryItem | null, equipped: RuntimeInventoryItem | null): boolean {
	if (!candidate?.id) return false;
	if (!equipped?.id) return true;

	const candidateDefense = candidate.defense ?? 0;
	const equippedDefense = equipped.defense ?? 0;
	if (candidateDefense > equippedDefense) return true;
	if (candidateDefense < equippedDefense) return false;

	const candidateChance = candidate.defenseChance ?? 0;
	const equippedChance = equipped.defenseChance ?? 0;
	return candidateChance > equippedChance;
}

function isHealthConsumable(item: RuntimeInventoryItem | null): boolean {
	if (!item || item.type !== 'item') return false;
	if ((item.heal || 0) > 0) return true;
	return item.effect === 'full_heal' || item.effect === 'extra_heart';
}

function formatWeapon(item: RuntimeInventoryItem | null): string {
	if (!item) return 'none';
	return `${item.id}[atk=${item.attack ?? 0},chance=${item.attackChance ?? 0}]`;
}

function formatArmor(item: RuntimeInventoryItem | null): string {
	if (!item) return 'none';
	return `${item.id}[def=${item.defense ?? 0},chance=${item.defenseChance ?? 0}]`;
}

async function simulateSingleGame(
	config: SimulationConfig,
	runIndex: number,
	seed: string
): Promise<PerGameSimulationLog> {
	const runRandom = createSeededRandom(seed);
	const behaviorByPlayerId: Record<string, SimulationBehavior> = {};
	const playersForLog: Array<{ playerId: string; playerName: string; behavior: SimulationBehavior }> = [];
	const errors: string[] = [];
	const questLog: string[] = [];
	const captureQuestLog = Boolean(
		config.output?.captureQuestLog ?? config.output?.writePerGameLogs ?? config.output?.writeTextReport
	);
	const biomeVisitCounts: Record<string, number> = {};
	const firstVisitTurnByBiome: Record<string, number | null> = {
		plains: null,
		forest: null,
		desert: null,
		cave: null,
		volcano: null,
		castle: null,
		town: null,
	};

	let gameId = '';
	let turnsPlayed = 0;
	let battlesWon = 0;
	let battlesLost = 0;
	let encounterCount = 0;
	let longestWinStreak = 0;
	let longestLoseStreak = 0;
	let currentWinStreak = 0;
	let currentLoseStreak = 0;
	let timedOut = false;
	let outcome: SimulationOutcome = 'aborted';
	let beatable = false;
	let earlyLoss = false;
	let lossSignals = 0;
	let lastEncounterTurn: number | null = null;
	const turnsBetweenEncounters: number[] = [];

	function addQuestLog(message: string) {
		if (!captureQuestLog) return;
		questLog.push(`T${turnsPlayed}: ${message}`);
	}

	try {
		await withRandomProvider(runRandom, async () => {
			const created = await createNewGame(10, 10);
			gameId = created.gameId;
			addQuestLog(`Game created with id=${gameId}`);

			for (let playerIndex = 0; playerIndex < config.playersPerGame; playerIndex += 1) {
				const playerName = `Bot-${playerIndex + 1}`;
				const joined = await joinExistingGame(gameId, playerName);
				const behavior = chooseBehavior(config.behaviorProfileWeights, runRandom());
				behaviorByPlayerId[joined.playerId] = behavior;
				playersForLog.push({ playerId: joined.playerId, playerName, behavior });
				addQuestLog(`Player joined: ${playerName} [${behavior}]`);
			}

			while (turnsPlayed < config.turnCap) {
				const state = await loadSerializedGame(gameId);
				if (state.gameCompletion?.completed) {
					outcome = 'win';
					beatable = true;
					addQuestLog('Raid boss defeated, game completed');
					break;
				}

				const currentPlayer = state.players?.[state.currentTurn];
				if (!currentPlayer) {
					errors.push('Current turn player missing');
					addQuestLog('Error: current turn player missing');
					outcome = 'aborted';
					break;
				}

				const currentBehavior = behaviorByPlayerId[currentPlayer.id] || 'aggressive';
				const currentPlayerState = extractRuntimePlayer(state, currentPlayer.id);
				if (!currentPlayerState) {
					errors.push('Current player state missing');
					outcome = 'aborted';
					break;
				}

				const currentBiome = state.biomeGrid?.[currentPlayerState.positionY]?.[currentPlayerState.positionX] || 'plains';
				addQuestLog(`${currentPlayer.name} turn start at (${currentPlayerState.positionX},${currentPlayerState.positionY}) biome=${currentBiome}`);
				biomeVisitCounts[currentBiome] = (biomeVisitCounts[currentBiome] || 0) + 1;
				if (Object.prototype.hasOwnProperty.call(firstVisitTurnByBiome, currentBiome)) {
					firstVisitTurnByBiome[currentBiome] = firstVisitTurnByBiome[currentBiome] ?? turnsPlayed;
				}

				if (state.currentBattle?.battleActive) {
					const battlePlayerId = state.currentBattle.playerId;
					const battlePlayer = extractRuntimePlayer(state, battlePlayerId);
					if (!battlePlayer) {
						errors.push('Battle player state missing');
						addQuestLog('Error: battle player state missing');
						outcome = 'aborted';
						break;
					}

					const battleProfile = behaviorByPlayerId[battlePlayerId] || currentBehavior;
					const isRaidBoss = state.currentBattle.monster?.id === 'evil_princess';
					const action = chooseBattleAction(
						battleProfile,
						state.currentBattle.playerHealth || 0,
						battlePlayer.maxHearts || 5,
						isRaidBoss
					);

					if (action === 'run') {
						addQuestLog(`${battlePlayer.name} chose to run from ${state.currentBattle?.monster?.name || 'monster'}`);
						await runFromBattle(gameId, battlePlayerId);
						battlesLost += 1;
						currentLoseStreak += 1;
						currentWinStreak = 0;
						longestLoseStreak = Math.max(longestLoseStreak, currentLoseStreak);
						lossSignals += 1;
						continue;
					}

					await attackBattle(gameId, battlePlayerId);
					addQuestLog(`${battlePlayer.name} attacked ${state.currentBattle?.monster?.name || 'monster'}`);
					const postAttackState = await loadSerializedGame(gameId);
					const postBattle = postAttackState.currentBattle;
					if (!postBattle || postBattle.battleActive) {
						continue;
					}

					if ((postBattle.monsterHealth || 0) <= 0 && (postBattle.playerHealth || 0) > 0) {
						const loot = await collectBattleLoot(gameId, battlePlayerId);
						addQuestLog(`${battlePlayer.name} defeated ${postBattle.monster?.name || 'monster'}`);
						if (loot.reward) {
							addQuestLog(
								`${battlePlayer.name} found item ${loot.reward.id} (${loot.reward.type})`
							);
						} else {
							addQuestLog(`${battlePlayer.name} found no loot reward`);
						}
						battlesWon += 1;
						currentWinStreak += 1;
						currentLoseStreak = 0;
						longestWinStreak = Math.max(longestWinStreak, currentWinStreak);

						if (loot.reward?.type === 'weapon' || loot.reward?.type === 'armor') {
							const postLootState = await loadSerializedGame(gameId);
							const lootPlayer = getPlayerEntry(postLootState, battlePlayerId);
							const inventory = lootPlayer?.inventory || {};
							const candidateItem = getItemFromState(postLootState, loot.reward.id);

							if (loot.reward.type === 'weapon') {
								const equippedWeapon = getItemFromState(postLootState, inventory.equippedWeaponId || 'fist');
								const shouldEquip = shouldEquipWeaponUpgrade(candidateItem, equippedWeapon);
								if (shouldEquip) {
									await equipItem(gameId, battlePlayerId, loot.reward.id);
									addQuestLog(
										`${battlePlayer.name} equipped weapon upgrade ${formatWeapon(candidateItem)} over ${formatWeapon(equippedWeapon)}`
									);
								} else {
									addQuestLog(
										`${battlePlayer.name} did not equip weapon ${formatWeapon(candidateItem)}; current ${formatWeapon(equippedWeapon)} is better or equal`
									);
								}
							} else {
								const equippedArmor = getItemFromState(postLootState, inventory.equippedArmorId || null);
								const shouldEquip = shouldEquipArmorUpgrade(candidateItem, equippedArmor);
								if (shouldEquip) {
									await equipItem(gameId, battlePlayerId, loot.reward.id);
									addQuestLog(
										`${battlePlayer.name} equipped armor upgrade ${formatArmor(candidateItem)} over ${formatArmor(equippedArmor)}`
									);
								} else {
									addQuestLog(
										`${battlePlayer.name} did not equip armor ${formatArmor(candidateItem)}; current ${formatArmor(equippedArmor)} is better or equal`
									);
								}
							}
						} else if (loot.reward?.type === 'item') {
							const postLootState = await loadSerializedGame(gameId);
							const candidateItem = getItemFromState(postLootState, loot.reward.id);
							const shouldUseImmediately =
								isHealthConsumable(candidateItem) ||
								candidateItem?.id === 'extra_heart' ||
								(battleProfile === 'risk-averse'
									? runRandom() < 0.65
									: battleProfile === 'completionist'
										? runRandom() < 0.4
										: runRandom() < 0.3);
							addQuestLog(
								`${battlePlayer.name} item decision for ${loot.reward.id}: useImmediately=${shouldUseImmediately}`
							);
							if (shouldUseImmediately) {
								try {
									await useItem(gameId, battlePlayerId, loot.reward.id);
									addQuestLog(`${battlePlayer.name} used item ${loot.reward.id} immediately`);
								} catch (_error) {
									// Item may not be immediately usable; skip.
									addQuestLog(`${battlePlayer.name} could not use item ${loot.reward.id}`);
								}
							} else {
								addQuestLog(`${battlePlayer.name} kept item ${loot.reward.id} for later`);
							}
						}
						continue;
					}

					if ((postBattle.playerHealth || 0) <= 0) {
						await returnPlayerToTown(gameId, battlePlayerId);
						addQuestLog(`${battlePlayer.name} was defeated and returned to town`);
						battlesLost += 1;
						currentLoseStreak += 1;
						currentWinStreak = 0;
						longestLoseStreak = Math.max(longestLoseStreak, currentLoseStreak);
						lossSignals += 1;
					}

					continue;
				}

				const rollResult = await rollDiceForPlayer(gameId, currentPlayer.id);
				addQuestLog(`${currentPlayer.name} rolled ${rollResult.diceRoll}`);
				if (!rollResult.validMoves || rollResult.validMoves.length === 0) {
					errors.push('No valid move options after roll');
					addQuestLog('Error: no valid move options after roll');
					outcome = 'aborted';
					break;
				}

				const seenBiomes = new Set(
					Object.keys(biomeVisitCounts).filter(key => (biomeVisitCounts[key] || 0) > 0)
				);
				const selectedMove = chooseMoveForBehavior(
					currentBehavior,
					rollResult.validMoves,
					currentPlayerState,
					state,
					seenBiomes
				);
				await movePlayerToTarget(gameId, currentPlayer.id, selectedMove.x, selectedMove.y);
				addQuestLog(`${currentPlayer.name} moved to (${selectedMove.x},${selectedMove.y})`);
				turnsPlayed += 1;

				const postMoveState = await loadSerializedGame(gameId);
				if (postMoveState.currentBattle?.battleActive) {
					encounterCount += 1;
					addQuestLog(
						`${currentPlayer.name} encountered ${postMoveState.currentBattle.monster?.name || 'monster'} in ${postMoveState.currentBattle.biome}`
					);
					if (lastEncounterTurn !== null) {
						turnsBetweenEncounters.push(turnsPlayed - lastEncounterTurn);
					}
					lastEncounterTurn = turnsPlayed;
				}

				if (lossSignals >= (config.lossCap || 12)) {
					outcome = 'loss';
					earlyLoss = turnsPlayed <= (config.earlyLossTurnThreshold || 20);
					addQuestLog(`Loss cap reached (${lossSignals}), ending game as loss`);
					break;
				}
			}

			if (outcome === 'aborted' && turnsPlayed >= config.turnCap) {
				timedOut = true;
				outcome = 'timeout';
				addQuestLog('Turn cap reached, timed out');
			}
			if (!['win', 'loss', 'timeout'].includes(outcome)) {
				if (turnsPlayed >= config.turnCap) {
					timedOut = true;
					outcome = 'timeout';
					addQuestLog('Turn cap reached, timed out');
				} else if (errors.length === 0) {
					outcome = 'aborted';
					addQuestLog('Run aborted without explicit error');
				}
			}
		});
	} catch (error) {
		errors.push((error as Error)?.message || String(error));
		addQuestLog(`Unhandled error: ${(error as Error)?.message || String(error)}`);
		outcome = 'aborted';
	} finally {
		if (gameId) {
			try {
				await clearGameDataById(gameId);
				addQuestLog('Game cleanup complete');
			} catch (_cleanupError) {
				// cleanup best effort
				addQuestLog('Game cleanup failed');
			}
		}
	}

	return {
		runIndex,
		seed,
		players: playersForLog,
		outcome,
		turnsPlayed,
		battlesWon,
		battlesLost,
		encounterCount,
		avgTurnsBetweenEncounters: safeMean(turnsBetweenEncounters),
		longestWinStreak,
		longestLoseStreak,
		turnsToOutcome: turnsPlayed,
		earlyLoss,
		timedOut,
		beatable,
		biomeVisitCounts,
		biomeProgressionCadence: firstVisitTurnByBiome,
		questLog,
		errors,
	};
}

export async function runSimulationBatch(
	inputConfig: Partial<SimulationConfig>,
	overrides: BalanceOverrideSet | null = null,
	baselineSummary?: SimulationBatchSummary,
	options: RunSimulationBatchOptions = {}
): Promise<SimulationBatchResult> {
	const config = normalizeConfig(inputConfig);
	applyBalanceOverrides(overrides);

	const results: PerGameSimulationLog[] = [];
	let nextRunIndex = 0;
	let completedRuns = 0;
	let activeRuns = 0;
	const startedAt = Date.now();
	let lastProgressAt = 0;
	let progressFilePath: string | undefined;
	const label = options.label || config.seed;
	const progressEvery = Math.max(1, Math.floor(options.progressEvery ?? Math.max(1, Math.floor(config.runs / 20))));
	const progressMinIntervalMs = Math.max(0, Math.floor(options.progressMinIntervalMs ?? 1000));
	if (config.output?.artifactDir) {
		const safeLabel = label
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/g, '-')
			.replace(/-{2,}/g, '-')
			.replace(/^-|-$/g, '') || 'run';
		progressFilePath = path.join(config.output.artifactDir, `progress-${safeLabel}.json`);
		await fs.mkdir(config.output.artifactDir, { recursive: true });
	}

	const emitProgress = (force = false) => {
		if (!options.onProgress) return;
		if (completedRuns <= 0 && activeRuns <= 0 && !force) return;
		const now = Date.now();
		if (!force) {
			if (completedRuns % progressEvery !== 0 && completedRuns !== config.runs && completedRuns !== 0) return;
			if (now - lastProgressAt < progressMinIntervalMs && completedRuns !== config.runs) return;
		}
		lastProgressAt = now;
		const elapsedMs = Math.max(1, now - startedAt);
		const runsPerMs = completedRuns / elapsedMs;
		const etaMs = completedRuns > 0 ? Math.max(0, Math.round((config.runs - completedRuns) / runsPerMs)) : -1;
		const progressPayload: SimulationBatchProgress = {
			label,
			completedRuns,
			totalRuns: config.runs,
			activeRuns,
			percentComplete: Number(((completedRuns / config.runs) * 100).toFixed(2)),
			elapsedMs,
			etaMs,
			runsPerMinute: Number((runsPerMs * 60000).toFixed(2)),
		};

		if (progressFilePath) {
			void fs.writeFile(progressFilePath, JSON.stringify(progressPayload, null, 2), 'utf-8');
		}
		options.onProgress({
			...progressPayload,
		});
	};

	const heartbeat =
		options.onProgress && progressMinIntervalMs > 0
			? setInterval(() => {
				emitProgress(true);
			}, progressMinIntervalMs)
			: undefined;

	const workers = Array.from({ length: config.parallelism }, async () => {
		while (true) {
			const runIndex = nextRunIndex;
			nextRunIndex += 1;
			if (runIndex >= config.runs) {
				break;
			}
			const seed = generateRunSeed(config.seed, runIndex);
			activeRuns += 1;
			emitProgress(false);
			try {
				const gameResult = await simulateSingleGame(config, runIndex, seed);
				results.push(gameResult);
			} finally {
				activeRuns = Math.max(0, activeRuns - 1);
				completedRuns += 1;
				emitProgress(false);
			}
		}
	});

	await Promise.all(workers);
	if (heartbeat) {
		clearInterval(heartbeat);
	}
	emitProgress(true);
	results.sort((left, right) => left.runIndex - right.runIndex);
	const summary = summarizeBatch(config, results, baselineSummary);

	const batchResult: SimulationBatchResult = {
		config,
		appliedOverrides: overrides ? deepClone(overrides) : null,
		summary,
		perGame: results,
		textReport: undefined,
	};
	if (config.output?.writeTextReport) {
		batchResult.textReport = renderBatchTextReport(batchResult);
	}
	await maybeWriteArtifacts(batchResult);
	return batchResult;
}

export async function runBaselineVsCandidate(
	inputConfig: Partial<SimulationConfig>,
	candidateOverrides: BalanceOverrideSet
): Promise<{
	baseline: SimulationBatchResult;
	candidate: SimulationBatchResult;
	scorecard: {
		winRateDelta: number;
		lossRateDelta: number;
		timeoutRateDelta: number;
		beatableRateDelta: number;
		winLossRatioDelta: number;
		regressionFail: boolean;
	};
}> {
	const config = normalizeConfig(inputConfig);
	const baseline = await runSimulationBatch(config, null, undefined);
	const candidate = await runSimulationBatch(config, candidateOverrides, baseline.summary);

	const scorecard = {
		winRateDelta: Number((candidate.summary.winRate - baseline.summary.winRate).toFixed(4)),
		lossRateDelta: Number((candidate.summary.lossRate - baseline.summary.lossRate).toFixed(4)),
		timeoutRateDelta: Number((candidate.summary.timeoutRate - baseline.summary.timeoutRate).toFixed(4)),
		beatableRateDelta: Number((candidate.summary.beatableRate - baseline.summary.beatableRate).toFixed(4)),
		winLossRatioDelta: Number((candidate.summary.winLossRatio - baseline.summary.winLossRatio).toFixed(4)),
		regressionFail:
			candidate.summary.failSignals.beatableRateDropped ||
			candidate.summary.failSignals.timeoutRateTooHigh ||
			candidate.summary.failSignals.winLossRatioOutsideBand,
	};

	return {
		baseline,
		candidate,
		scorecard,
	};
}

export function buildScaledBaselineOverrides(scales: {
	monsterBaseScale?: number;
	monsterVariantScale?: number;
	itemBaseScale?: number;
	itemVariantScale?: number;
	encounterRateScale?: number;
	chanceDelta?: number;
	healthItemDropScale?: number;
	extraHeartDropScale?: number;
}): BalanceOverrideSet {
	const monsterBaseScale = scales.monsterBaseScale ?? 1;
	const monsterVariantScale = scales.monsterVariantScale ?? 1;
	const itemBaseScale = scales.itemBaseScale ?? 1;
	const itemVariantScale = scales.itemVariantScale ?? 1;
	const encounterRateScale = scales.encounterRateScale ?? 1;
	const chanceDelta = scales.chanceDelta ?? 0;
	const healthItemDropScale = scales.healthItemDropScale ?? 1;
	const extraHeartDropScale = scales.extraHeartDropScale ?? healthItemDropScale;

	const biomeEncounterRates = Object.fromEntries(
		Object.entries(getBiomeEncounterRates()).map(([biome, rate]) => [biome, clampRate(rate * encounterRateScale)])
	);

	const monster = deepClone(DEFAULT_MONSTER_BALANCE_PROFILE);
	for (const biome of Object.keys(monster.biomeTierBaseStats) as Array<keyof typeof monster.biomeTierBaseStats>) {
		monster.biomeTierBaseStats[biome].health = Math.max(1, Math.round(monster.biomeTierBaseStats[biome].health * monsterBaseScale));
		monster.biomeTierBaseStats[biome].attack = Math.max(1, Math.round(monster.biomeTierBaseStats[biome].attack * monsterBaseScale));
		monster.biomeTierBaseStats[biome].defense = Math.max(0, Math.round(monster.biomeTierBaseStats[biome].defense * monsterBaseScale));
		monster.biomeTierBaseStats[biome].attackChance = clampRate(
			monster.biomeTierBaseStats[biome].attackChance + chanceDelta
		);
		monster.biomeTierBaseStats[biome].defenseChance = clampRate(
			monster.biomeTierBaseStats[biome].defenseChance + chanceDelta
		);
	}
	for (const variant of Object.keys(monster.variantModifiers) as Array<keyof typeof monster.variantModifiers>) {
		monster.variantModifiers[variant].health = Math.round(monster.variantModifiers[variant].health * monsterVariantScale);
		monster.variantModifiers[variant].attack = Math.round(monster.variantModifiers[variant].attack * monsterVariantScale);
		monster.variantModifiers[variant].defense = Math.round(monster.variantModifiers[variant].defense * monsterVariantScale);
		monster.variantModifiers[variant].attackChance = Number(
			(monster.variantModifiers[variant].attackChance * monsterVariantScale).toFixed(4)
		);
		monster.variantModifiers[variant].defenseChance = Number(
			(monster.variantModifiers[variant].defenseChance * monsterVariantScale).toFixed(4)
		);
	}

	const item = deepClone(DEFAULT_ITEM_BALANCE_PROFILE);
	for (const tier of [1, 2, 3] as const) {
		item.tierBase.weapon[tier].attack = Math.max(1, Math.round(item.tierBase.weapon[tier].attack * itemBaseScale));
		item.tierBase.weapon[tier].attackChance = clampRate(item.tierBase.weapon[tier].attackChance + chanceDelta);
		item.tierBase.armor[tier].defense = Math.max(0, Math.round(item.tierBase.armor[tier].defense * itemBaseScale));
		item.tierBase.armor[tier].defenseChance = clampRate(item.tierBase.armor[tier].defenseChance + chanceDelta);
	}
	for (const variant of ['cracked', 'normal', 'enchanted'] as const) {
		item.variantModifiers[variant].valueDelta = Math.round(item.variantModifiers[variant].valueDelta * itemVariantScale);
		item.variantModifiers[variant].chanceDelta = Number(
			(item.variantModifiers[variant].chanceDelta * itemVariantScale).toFixed(4)
		);
	}
	item.dropRates.healthItemMultiplier = Number((item.dropRates.healthItemMultiplier * healthItemDropScale).toFixed(4));
	item.dropRates.extraHeartMultiplier = Number((item.dropRates.extraHeartMultiplier * extraHeartDropScale).toFixed(4));

	return {
		biomeEncounterRates,
		monster,
		item,
	};
}
