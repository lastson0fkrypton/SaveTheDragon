import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createSeededRandom, withRandomProvider } from './random.js';

export type SimOptions = {
	games: number;
	maxTurns: number;
	seed: string;
	gridSizeX: number;
	gridSizeY: number;
	playerName: string;
	deckDefinitionsConfigPath?: string;
	balanceConfigPath?: string;
};

type SimEvent = {
	turn: number;
	type: string;
	detail: string;
};

export type SingleRunResult = {
	gameId: string;
	completed: boolean;
	reason: string;
	turnsPlayed: number;
	bossDefeated: boolean;
	recentActionsCount: number;
	events: SimEvent[];
};

export type AggregateResult = {
	totalGames: number;
	successfulGames: number;
	successRate: number;
	minTurnsPlayed: number;
	avgTurnsPlayed: number;
	maxTurnsPlayed: number;
};

export type SimulationRunOutput = {
	options: SimOptions;
	aggregate: AggregateResult;
	runs: SingleRunResult[];
	generatedAt: string;
	outputDir?: string;
};

type RunOptions = {
	writeArtifacts?: boolean;
	artifactRoot?: string;
	runName?: string;
};

async function generateDeckDefinitionsFile(outPath?: string, balancePath?: string): Promise<string> {
	const targetPath = outPath || path.resolve(os.tmpdir(), `deck-definitions-${Date.now()}.json`);
	const generatorScript = path.resolve(process.cwd(), '..', 'deck-generator', 'src', 'generateDeckDefinitions.ts');
	const generatorArgs = ['--import', 'tsx', generatorScript, `--out=${targetPath}`];
	if (balancePath) {
		generatorArgs.push(`--balance=${balancePath}`);
	}

	await new Promise<void>((resolve, reject) => {
		const child = spawn(process.execPath, generatorArgs, {
			cwd: process.cwd(),
			env: { ...process.env },
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let stderr = '';
		child.stderr.on('data', chunk => {
			stderr += chunk.toString();
		});

		child.on('error', reject);
		child.on('close', code => {
			if (code !== 0) {
				reject(new Error(`Deck generator exited with code ${code}: ${stderr.trim() || 'no stderr output'}`));
				return;
			}
			resolve();
		});
	});

	return targetPath;
}

function createIsolatedDeckDefinitionsPath(prefix: string): string {
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	return path.resolve(os.tmpdir(), `${prefix}-${suffix}.json`);
}

async function resolveDeckDefinitionsForRun(options: SimOptions): Promise<{ path: string; cleanup: boolean }> {
	if (options.balanceConfigPath) {
		const isolatedPath = createIsolatedDeckDefinitionsPath('deck-definitions-balance');
		const generated = await generateDeckDefinitionsFile(isolatedPath, options.balanceConfigPath);
		return { path: generated, cleanup: true };
	}

	if (options.deckDefinitionsConfigPath && fs.existsSync(options.deckDefinitionsConfigPath)) {
		const isolatedPath = createIsolatedDeckDefinitionsPath('deck-definitions-copy');
		fs.copyFileSync(options.deckDefinitionsConfigPath, isolatedPath);
		return { path: isolatedPath, cleanup: true };
	}

	const generated = await generateDeckDefinitionsFile();
	return { path: generated, cleanup: true };
}

function parseArgs(): SimOptions {
	const args = process.argv.slice(2);
	const pairs = new Map<string, string>();
	for (const arg of args) {
		if (!arg.startsWith('--')) continue;
		const [key, value] = arg.replace(/^--/, '').split('=');
		pairs.set(key, value ?? '');
	}

	return {
		games: Math.max(1, Number(pairs.get('games') || 1)),
		maxTurns: Math.max(20, Number(pairs.get('maxTurns') || 140)),
		seed: pairs.get('seed') || `deck-sim-${Date.now()}`,
		gridSizeX: Math.max(10, Number(pairs.get('gridSizeX') || 20)),
		gridSizeY: Math.max(10, Number(pairs.get('gridSizeY') || 20)),
		playerName: pairs.get('playerName') || 'SimBot',
		deckDefinitionsConfigPath:
			pairs.get('deckDefinitionsConfigPath') ||
			process.env.DECK_DEFINITIONS_CONFIG_PATH ||
			path.resolve(process.cwd(), '..', 'server', 'config', 'deck-definitions.json'),
		balanceConfigPath: pairs.get('balanceConfigPath') || process.env.DECK_BALANCE_CONFIG_PATH || undefined,
	};
}

function average(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pickCastleTarget(gameState): { x: number; y: number } {
	const grid = gameState.biomeGrid || [];
	for (let y = 0; y < grid.length; y += 1) {
		for (let x = 0; x < (grid[y] || []).length; x += 1) {
			if (grid[y][x] === 'castle') {
				return { x, y };
			}
		}
	}
	return { x: 0, y: 0 };
}

function chooseMoveTowardTarget(validMoves: Array<{ x: number; y: number }>, target: { x: number; y: number }) {
	if (!Array.isArray(validMoves) || validMoves.length === 0) {
		return null;
	}
	let selected = validMoves[0];
	let bestDistance = Math.abs(selected.x - target.x) + Math.abs(selected.y - target.y);
	for (const move of validMoves) {
		const distance = Math.abs(move.x - target.x) + Math.abs(move.y - target.y);
		if (distance < bestDistance) {
			bestDistance = distance;
			selected = move;
		}
	}
	return selected;
}

function findBestEquip(inventoryIds: string[], itemMeta: Record<string, any>, statKey: 'attack' | 'defense', chanceKey: 'attackChance' | 'defenseChance') {
	let bestId: string | null = null;
	let bestScore = -1;
	for (const itemId of inventoryIds || []) {
		const item = itemMeta[itemId];
		if (!item) continue;
		const score = (item[statKey] || 0) * (item[chanceKey] || 0);
		if (score > bestScore) {
			bestScore = score;
			bestId = itemId;
		}
	}
	return bestId;
}

async function apiRequest(baseUrl: string, method: string, pathName: string, body?: unknown) {
	const response = await fetch(`${baseUrl}${pathName}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await response.text();
	const payload = text ? JSON.parse(text) : null;
	if (!response.ok) {
		const detail = payload?.error || `${response.status}`;
		throw new Error(`${method} ${pathName} failed: ${detail}`);
	}
	return payload;
}

async function maybeUseHealingItem(baseUrl: string, gameId: string, player, itemMeta: Record<string, any>, events: SimEvent[], turn: number) {
	const maxHearts = player.maxHearts || 5;
	const damage = player.damage || 0;
	const inventoryItems: string[] = player.inventory?.items || [];
	let extraHeartItemId: string | null = null;
	for (const itemId of inventoryItems) {
		const item = itemMeta[itemId];
		if (item?.effect === 'extra_heart') {
			extraHeartItemId = itemId;
			break;
		}
	}

	if (extraHeartItemId && maxHearts < 12 && damage >= 2) {
		await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/player/${player.id}/use-item`, { itemId: extraHeartItemId });
		events.push({ turn, type: 'use-item', detail: extraHeartItemId });
		return;
	}

	if (damage < Math.max(2, Math.floor(maxHearts * 0.35))) {
		return;
	}

	let selectedItemId: string | null = null;
	let selectedHeal = -1;
	for (const itemId of inventoryItems) {
		const item = itemMeta[itemId];
		if (!item) continue;
		if (typeof item.heal === 'number' && item.heal > selectedHeal) {
			selectedHeal = item.heal;
			selectedItemId = itemId;
		}
	}
	if (!selectedItemId) return;

	await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/player/${player.id}/use-item`, { itemId: selectedItemId });
	events.push({ turn, type: 'use-item', detail: selectedItemId });
}

async function maybeEquipBestItems(baseUrl: string, gameId: string, player, itemMeta: Record<string, any>, events: SimEvent[], turn: number) {
	const inventory = player.inventory || {};
	const bestWeapon = findBestEquip(inventory.weapons || [], itemMeta, 'attack', 'attackChance');
	if (bestWeapon && bestWeapon !== inventory.equippedWeaponId) {
		await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/player/${player.id}/equip`, { itemId: bestWeapon });
		events.push({ turn, type: 'equip-weapon', detail: bestWeapon });
	}

	const bestArmor = findBestEquip(inventory.armor || [], itemMeta, 'defense', 'defenseChance');
	if (bestArmor && bestArmor !== inventory.equippedArmorId) {
		await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/player/${player.id}/equip`, { itemId: bestArmor });
		events.push({ turn, type: 'equip-armor', detail: bestArmor });
	}
}

function chooseBattleItem(player, battle, itemMeta: Record<string, any>) {
	const inventoryItems: string[] = player?.inventory?.items || [];
	if (inventoryItems.length === 0) return null;

	const maxHearts = player?.maxHearts || 5;
	const playerHealth = battle?.playerHealth || Math.max(1, maxHearts - (player?.damage || 0));
	const lowHealthThreshold = Math.max(2, Math.ceil(maxHearts * 0.4));
	const isBossBattle = battle?.monster?.id === 'evil_princess';

	let teleportId: string | null = null;
	let fullHealId: string | null = null;
	let extraHeartId: string | null = null;
	const healCandidates: Array<{ id: string; heal: number }> = [];

	for (const itemId of inventoryItems) {
		const item = itemMeta[itemId];
		if (!item) continue;
		if (item.effect === 'teleport' && !teleportId) {
			teleportId = itemId;
			continue;
		}
		if (item.effect === 'heal_full' && !fullHealId) {
			fullHealId = itemId;
			continue;
		}
		if (item.effect === 'extra_heart' && !extraHeartId) {
			extraHeartId = itemId;
			continue;
		}
		if (typeof item.heal === 'number' && item.heal > 0) {
			healCandidates.push({ id: itemId, heal: item.heal });
		}
	}

	if (isBossBattle && teleportId && playerHealth <= Math.ceil(maxHearts * 0.5)) {
		return teleportId;
	}

	if (playerHealth > lowHealthThreshold) {
		if (extraHeartId && (player?.maxHearts || 5) < 12 && playerHealth <= Math.ceil(maxHearts * 0.7)) {
			return extraHeartId;
		}
		return null;
	}

	if (fullHealId) return fullHealId;

	if (healCandidates.length > 0) {
		healCandidates.sort((a, b) => a.heal - b.heal);
		const needed = Math.max(1, maxHearts - playerHealth);
		const exactish = healCandidates.find(entry => entry.heal >= needed);
		return (exactish || healCandidates[healCandidates.length - 1]).id;
	}

	if (extraHeartId) return extraHeartId;
	if (teleportId) return teleportId;

	return null;
}

async function resolveBattle(baseUrl: string, gameId: string, playerId: string, events: SimEvent[], turn: number) {
	while (true) {
		const state = await apiRequest(baseUrl, 'GET', `/api/games/${gameId}/state`);
		const battle = state.currentBattle;
		if (!battle || battle.playerId !== playerId) {
			return state;
		}

		if (battle.battleActive) {
			const player = (state.players || []).find(entry => entry.id === playerId);
			const battleItemId = chooseBattleItem(player, battle, state.itemMeta || {});
			if (battleItemId) {
				try {
					const useResult = await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/battle/use-item`, {
						playerId,
						itemId: battleItemId,
					});
					const tail = (useResult?.battleLog || []).slice(-1)[0] || battleItemId;
					events.push({ turn, type: 'battle-use-item', detail: tail });
					if (useResult?.escaped) {
						return apiRequest(baseUrl, 'GET', `/api/games/${gameId}/state`);
					}
					continue;
				} catch (_error) {
					// Fall through to attack if item usage is rejected for any reason.
				}
			}

			const attackResult = await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/battle/attack`, { playerId });
			const tail = (attackResult?.battleLog || []).slice(-1)[0] || 'battle tick';
			events.push({ turn, type: 'battle-attack', detail: tail });
			continue;
		}

		if (battle.monsterHealth <= 0 && battle.playerHealth > 0) {
			const rewardResult = await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/battle/collect-loot`, { playerId });
			const rewardId = rewardResult?.reward?.item?.id || rewardResult?.reward?.item?.name || rewardResult?.reward?.kind || 'none';
			events.push({ turn, type: 'battle-loot', detail: String(rewardId) });
			return apiRequest(baseUrl, 'GET', `/api/games/${gameId}/state`);
		}

		await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/battle/return-to-town`, { playerId });
		events.push({ turn, type: 'battle-defeat', detail: 'returned-to-town' });
		return apiRequest(baseUrl, 'GET', `/api/games/${gameId}/state`);
	}
}

async function simulateSingleGame(baseUrl: string, options: SimOptions, runIndex: number): Promise<SingleRunResult> {
	const events: SimEvent[] = [];
	const gameCreate = await apiRequest(baseUrl, 'POST', '/api/games', {
		gridSizeX: options.gridSizeX,
		gridSizeY: options.gridSizeY,
	});
	const gameId = gameCreate.gameId;
	await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/join`, { playerName: `${options.playerName}-${runIndex + 1}` });
	const joined = await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/reconnect`, { playerName: `${options.playerName}-${runIndex + 1}` });
	const playerId = joined.playerId;
	let lastState = joined.gameState;
	const castleTarget = pickCastleTarget(lastState);

	for (let turn = 1; turn <= options.maxTurns; turn += 1) {
		lastState = await apiRequest(baseUrl, 'GET', `/api/games/${gameId}/state`);
		const me = (lastState.players || []).find(player => player.id === playerId);
		if (!me) {
			return {
				gameId,
				completed: false,
				reason: 'player-not-found',
				turnsPlayed: turn,
				bossDefeated: Boolean(lastState.raidBoss?.defeated),
				recentActionsCount: Array.isArray(lastState.recentActions) ? lastState.recentActions.length : 0,
				events,
			};
		}

		if (lastState.gameCompletion?.completed) {
			return {
				gameId,
				completed: true,
				reason: String(lastState.gameCompletion?.reason || 'completed'),
				turnsPlayed: turn,
				bossDefeated: Boolean(lastState.raidBoss?.defeated),
				recentActionsCount: Array.isArray(lastState.recentActions) ? lastState.recentActions.length : 0,
				events,
			};
		}

		if (lastState.currentBattle?.playerId === playerId) {
			lastState = await resolveBattle(baseUrl, gameId, playerId, events, turn);
			continue;
		}

		await maybeUseHealingItem(baseUrl, gameId, me, lastState.itemMeta || {}, events, turn);
		await maybeEquipBestItems(baseUrl, gameId, me, lastState.itemMeta || {}, events, turn);

		const roll = await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/roll`, { playerId });
		const selectedMove = chooseMoveTowardTarget(roll.validMoves || [], castleTarget);
		if (!selectedMove) {
			events.push({ turn, type: 'no-valid-move', detail: 'stalled' });
			continue;
		}

		const moveResult = await apiRequest(baseUrl, 'POST', `/api/games/${gameId}/move`, {
			playerId,
			targetX: selectedMove.x,
			targetY: selectedMove.y,
		});
		const landedBiome = moveResult?.gameState?.biomeGrid?.[selectedMove.y]?.[selectedMove.x] || 'unknown';
		events.push({ turn, type: 'move', detail: `(${selectedMove.x},${selectedMove.y}) ${landedBiome}` });
	}

	lastState = await apiRequest(baseUrl, 'GET', `/api/games/${gameId}/state`);
	return {
		gameId,
		completed: Boolean(lastState.gameCompletion?.completed),
		reason: lastState.gameCompletion?.completed ? String(lastState.gameCompletion?.reason || 'completed') : 'max-turns-reached',
		turnsPlayed: options.maxTurns,
		bossDefeated: Boolean(lastState.raidBoss?.defeated),
		recentActionsCount: Array.isArray(lastState.recentActions) ? lastState.recentActions.length : 0,
		events,
	};
}

function summarize(results: SingleRunResult[]): AggregateResult {
	const successfulGames = results.filter(result => result.bossDefeated).length;
	const turns = results.map(result => result.turnsPlayed);
	return {
		totalGames: results.length,
		successfulGames,
		successRate: Number((successfulGames / Math.max(1, results.length)).toFixed(4)),
		minTurnsPlayed: turns.length > 0 ? Math.min(...turns) : 0,
		avgTurnsPlayed: Number(average(results.map(result => result.turnsPlayed)).toFixed(2)),
		maxTurnsPlayed: turns.length > 0 ? Math.max(...turns) : 0,
	};
}

function writeReport(options: SimOptions, aggregate: AggregateResult, runs: SingleRunResult[], outputDir: string): void {
	fs.mkdirSync(outputDir, { recursive: true });
	const result = { options, aggregate, runs, generatedAt: new Date().toISOString() };
	fs.writeFileSync(path.join(outputDir, 'deck-balance-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
	const reportText = [
		`API Simulation`,
		`games=${options.games}`,
		`maxTurns=${options.maxTurns}`,
		`seed=${options.seed}`,
		`successfulGames=${aggregate.successfulGames}`,
		`successRate=${aggregate.successRate}`,
		`minTurnsPlayed=${aggregate.minTurnsPlayed}`,
		`avgTurnsPlayed=${aggregate.avgTurnsPlayed}`,
		`maxTurnsPlayed=${aggregate.maxTurnsPlayed}`,
	].join('\n');
	fs.writeFileSync(path.join(outputDir, 'deck-balance-report.txt'), `${reportText}\n`, 'utf8');

	const gameLogText = runs
		.map((run, index) => {
			const header = `Game ${index + 1} (${run.gameId}) completed=${run.completed} reason=${run.reason} turns=${run.turnsPlayed}`;
			const body = run.events.map(event => `turn=${event.turn} type=${event.type} detail=${event.detail}`).join('\n');
			return `${header}\n${body}`;
		})
		.join('\n\n');
	fs.writeFileSync(path.join(outputDir, 'game-log.txt'), `${gameLogText}\n`, 'utf8');

	console.log(reportText);
	console.log(`Saved report to ${outputDir}`);
}

export async function runApiSimulation(options: SimOptions, runOptions: RunOptions = {}): Promise<SimulationRunOutput> {
	const resolvedDeckDefinitions = await resolveDeckDefinitionsForRun(options);
	const deckDefinitionsPath = resolvedDeckDefinitions.path;
	if (!fs.existsSync(deckDefinitionsPath)) {
		throw new Error(`Deck definitions were not generated: ${deckDefinitionsPath}`);
	}

	process.env.SAVE_THE_DRAGON_DB_CLIENT = 'in-memory';
	process.env.DECK_DEFINITIONS_CONFIG_PATH = deckDefinitionsPath;

	const { startServer } = await import('../../server/serverApp.js');
	const started = await startServer({ port: 0, disableCleanupInterval: true, silent: true });
	const baseUrl = `http://127.0.0.1:${started.port}`;

	try {
		const provider = createSeededRandom(options.seed);
		const runs = await withRandomProvider(provider, async () => {
			const list: SingleRunResult[] = [];
			for (let index = 0; index < options.games; index += 1) {
				list.push(await simulateSingleGame(baseUrl, options, index));
			}
			return list;
		});

		const aggregate = summarize(runs);
		const output: SimulationRunOutput = {
			options: { ...options, deckDefinitionsConfigPath: deckDefinitionsPath },
			aggregate,
			runs,
			generatedAt: new Date().toISOString(),
		};

		if (runOptions.writeArtifacts !== false) {
			const outputRoot = runOptions.artifactRoot || 'simulation-output';
			const runFolder = runOptions.runName || `deck-sim-${Date.now()}`;
			const outputDir = path.resolve(process.cwd(), outputRoot, runFolder);
			writeReport(options, aggregate, runs, outputDir);
			output.outputDir = outputDir;
		}

		return output;
	} finally {
		await started.stop();
		if (resolvedDeckDefinitions.cleanup && fs.existsSync(deckDefinitionsPath)) {
			try {
				fs.unlinkSync(deckDefinitionsPath);
			} catch {
				// best effort cleanup
			}
		}
	}
}

async function main() {
	const options = parseArgs();
	await runApiSimulation(options, { writeArtifacts: true });
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
	main().catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
}
