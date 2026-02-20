import { CHARACTERS } from '../constants/characters.js';
import { getItemDefs } from '../constants/items.js';
import { EVIL_PRINCESS_MONSTER } from '../constants/monsters.js';
import type { PlayBiome } from '../config/biomeDeckConfig.js';
import { createBiomeDeckRuntime, drawEncounterCard, type BiomeDeckRuntime } from './biomeDeckService.js';
import {
	createGame,
	createPlayer,
	getGameById,
	getPlayerByGameIdAndName,
	getPlayerStateRowsByGameId,
	getPlayersByGameId,
	getValidMovesByGameId,
	setValidMovesByGameId,
	updateGameStateJson,
	updatePlayerStateById,
	clearValidMovesByGameId,
} from '../repositories/gameRepository.js';
import { addRecentAction, generateBiomeGrid, serializeGame } from '../utils/gameUtils.js';
import { randomChoice, randomId, randomInt } from '../utils/random.js';
import { serviceError } from './serviceErrors.js';

const REQUIRED_EXTRA_HEART_ITEM_ID = 'extra_heart';

function isDeckBiome(biome: string): biome is PlayBiome {
	return biome === 'plains' || biome === 'forest' || biome === 'desert' || biome === 'cave' || biome === 'volcano';
}

function ensureBiomeDeckState(gameState): BiomeDeckRuntime {
	if (!gameState.biomeDecks) {
		gameState.biomeDecks = createBiomeDeckRuntime();
	}
	return gameState.biomeDecks;
}

function ensureInventory(playerState): void {
	if (!playerState.inventory) {
		playerState.inventory = { weapons: [], armor: [], items: [], equippedWeaponId: 'fist', equippedArmorId: null };
	}
	if (!Array.isArray(playerState.inventory.weapons)) playerState.inventory.weapons = [];
	if (!Array.isArray(playerState.inventory.armor)) playerState.inventory.armor = [];
	if (!Array.isArray(playerState.inventory.items)) playerState.inventory.items = [];
}

function grantItemToPlayer(playerState, item): void {
	ensureInventory(playerState);
	if (item.type === 'weapon') {
		if (!playerState.inventory.weapons.includes(item.id)) {
			playerState.inventory.weapons.push(item.id);
		}
		return;
	}

	if (item.type === 'armor') {
		if (!playerState.inventory.armor.includes(item.id)) {
			playerState.inventory.armor.push(item.id);
		}
		return;
	}

	playerState.inventory.items.push(item.id);
}

function getExtraHeartItem() {
	return getItemDefs().find(item => item.id === REQUIRED_EXTRA_HEART_ITEM_ID) || null;
}

export function assertRequiredGameItems(itemDefs = getItemDefs()): void {
	const hasExtraHeart = itemDefs.some(item => item.id === REQUIRED_EXTRA_HEART_ITEM_ID);
	if (!hasExtraHeart) {
		throw new Error(`Missing required item definition: ${REQUIRED_EXTRA_HEART_ITEM_ID}`);
	}
}

assertRequiredGameItems();

function buildGameState(gameRow, playerRows, validMoveRows) {
	return serializeGame(gameRow, playerRows, validMoveRows);
}

async function loadSerializedGame(gameId) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) {
		throw serviceError(404, 'Game not found');
	}
	const gameState = getGameState(gameRow);
	const raidBossBefore = gameState.raidBoss;
	const completionBefore = gameState.gameCompletion;
	const deckBefore = gameState.biomeDecks;
	ensureRaidBossState(gameState);
	ensureBiomeDeckState(gameState);
	if (!raidBossBefore || !completionBefore || !deckBefore) {
		await updateGameStateJson(gameId, JSON.stringify(gameState));
	}
	const [playerRows, validMoveRows] = await Promise.all([
		getPlayersByGameId(gameId),
		getValidMovesByGameId(gameId),
	]);
	return buildGameState({ ...gameRow, gameStateJson: JSON.stringify(gameState) }, playerRows, validMoveRows);
}

function parseJson(text, fallback = {}) {
	if (!text) return fallback;
	try {
		return JSON.parse(text);
	} catch (_error) {
		return fallback;
	}
}

function getPlayerState(playerRow) {
	return parseJson(playerRow?.playerStateJson, {});
}

function getGameState(gameRow) {
	return parseJson(gameRow?.gameStateJson, {});
}

function ensureRaidBossState(gameState) {
	if (!gameState.raidBoss) {
		gameState.raidBoss = {
			...EVIL_PRINCESS_MONSTER,
			maxHealth: EVIL_PRINCESS_MONSTER.health,
			currentHealth: EVIL_PRINCESS_MONSTER.health,
			defeated: false,
		};
	}
	if (!gameState.gameCompletion) {
		gameState.gameCompletion = { completed: false };
	}
	return gameState.raidBoss;
}

function ensureGameNotCompleted(gameState) {
	if (gameState?.gameCompletion?.completed) {
		throw serviceError(400, 'Game is complete. Start a new game to continue playing.');
	}
}

function pickPlayerSpawn(gameState, usedPositions) {
	const gridSizeX = gameState.gridSizeX || 10;
	const gridSizeY = gameState.gridSizeY || 10;
	const biomeGrid = gameState.biomeGrid;
	if (!biomeGrid) return { x: 0, y: 0 };

	let possiblePositions = [];
	let townCenters = biomeGrid._townCenters || null;

	if (!townCenters) {
		townCenters = [];
		for (let y = 0; y < gridSizeY; y++) {
			for (let x = 0; x < gridSizeX; x++) {
				if (biomeGrid[y][x] === 'town') townCenters.push({ x, y });
			}
		}
	}

	for (const { x, y } of townCenters) {
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				if (dx === 0 && dy === 0) continue;
				const nx = x + dx;
				const ny = y + dy;
				if (
					nx >= 0 &&
					nx < gridSizeX &&
					ny >= 0 &&
					ny < gridSizeY &&
					biomeGrid[ny][nx] === 'plains' &&
					!usedPositions.includes(`${nx},${ny}`)
				) {
					possiblePositions.push({ x: nx, y: ny });
				}
			}
		}
	}

	if (possiblePositions.length === 0) {
		for (let x = 0; x < gridSizeX; x++) {
			for (let y = 0; y < gridSizeY; y++) {
				if (biomeGrid[y][x] === 'plains' && !usedPositions.includes(`${x},${y}`)) {
					possiblePositions.push({ x, y });
				}
			}
		}
	}

	if (possiblePositions.length === 0) {
		return { x: 0, y: 0 };
	}
	return randomChoice(possiblePositions);
}

function computeValidMoves(playerRow, playerRows, diceRoll, gridSizeX, gridSizeY) {
	const playerState = getPlayerState(playerRow);
	const moves = [];
	for (let dx = -diceRoll; dx <= diceRoll; dx++) {
		for (let dy = -diceRoll; dy <= diceRoll; dy++) {
			if (Math.abs(dx) + Math.abs(dy) <= diceRoll) {
				const x = playerState.positionX + dx;
				const y = playerState.positionY + dy;
				if (
					x >= 0 &&
					x < gridSizeX &&
					y >= 0 &&
					y < gridSizeY &&
					!playerRows.some(p => {
						if (p.id === playerRow.id) return false;
						const ps = getPlayerState(p);
						return ps.positionX === x && ps.positionY === y;
					})
				) {
					moves.push({ x, y });
				}
			}
		}
	}
	return moves;
}

async function createNewGame(gridSizeX, gridSizeY) {
	const safeX = Math.max(10, Math.min(100, parseInt(gridSizeX, 10) || 10));
	const safeY = Math.max(10, Math.min(100, parseInt(gridSizeY, 10) || 10));
	const gameId = randomId();
	const biomeGrid = generateBiomeGrid(safeX, safeY);
	const gameState = {
		currentTurn: 0,
		currentDiceRoll: null,
		gridSizeX: safeX,
		gridSizeY: safeY,
		biomeGrid,
		biomeDecks: createBiomeDeckRuntime(),
		raidBoss: {
			...EVIL_PRINCESS_MONSTER,
			maxHealth: EVIL_PRINCESS_MONSTER.health,
			currentHealth: EVIL_PRINCESS_MONSTER.health,
			defeated: false,
		},
		gameCompletion: { completed: false },
	};
	await createGame(gameId, JSON.stringify(gameState));
	return { gameId };
}

async function joinExistingGame(gameId, playerName) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');

	const [playerStateRows, existingPlayer] = await Promise.all([
		getPlayerStateRowsByGameId(gameId),
		getPlayerByGameIdAndName(gameId, playerName),
	]);

	if (existingPlayer) {
		return { playerId: existingPlayer.id };
	}

	const usedCharacters = playerStateRows.map(p => parseJson(p.playerStateJson).characterId);
	const usedPositions = playerStateRows
		.map(p => {
			const state = parseJson(p.playerStateJson);
			if (typeof state.positionX === 'number' && typeof state.positionY === 'number') {
				return `${state.positionX},${state.positionY}`;
			}
			return null;
		})
		.filter(Boolean);
	const availableCharacters = CHARACTERS.filter(character => !usedCharacters.includes(character.id));
	const randomCharacterId =
		availableCharacters.length > 0
			? randomChoice(availableCharacters).id
			: 'none';

	const gameState = getGameState(gameRow);
	const spawn = pickPlayerSpawn(gameState, usedPositions);
	const playerId = randomId();
	const playerState = {
		positionX: spawn.x,
		positionY: spawn.y,
		maxHearts: 5,
		damage: 0,
		characterId: randomCharacterId,
		inventory: {
			weapons: ['fist'],
			armor: [],
			items: [],
			equippedWeaponId: 'fist',
			equippedArmorId: null,
		},
	};

	await createPlayer(playerId, gameId, playerName, JSON.stringify(playerState));
	return { playerId };
}

async function rollDiceForPlayer(gameId, playerId) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');

	const gameState = getGameState(gameRow);
	ensureRaidBossState(gameState);
	ensureGameNotCompleted(gameState);
	const playerRows = await getPlayersByGameId(gameId);
	const player = playerRows.find(p => p.id === playerId);
	if (!player) throw serviceError(404, 'Player not found');
	if (!playerRows[gameState.currentTurn] || playerRows[gameState.currentTurn].id !== playerId) {
		throw serviceError(400, 'Not your turn');
	}
	if (gameState.currentDiceRoll) throw serviceError(400, 'Dice already rolled for this turn');

	const diceRoll = randomInt(6) + 1;
	const gridSizeX = gameState.gridSizeX || 10;
	const gridSizeY = gameState.gridSizeY || 10;
	const moves = computeValidMoves(player, playerRows, diceRoll, gridSizeX, gridSizeY);

	gameState.currentDiceRoll = diceRoll;
	await updateGameStateJson(gameId, JSON.stringify(gameState));
	await setValidMovesByGameId(gameId, moves);

	return { diceRoll, validMoves: moves };
}

function startEncounterIfNeeded(gameState, playerRows, playerId, playerState, biome) {
	const raidBoss = ensureRaidBossState(gameState);
	const isCastleBossEncounter = biome === 'castle' && !raidBoss.defeated && raidBoss.currentHealth > 0;

	if (isCastleBossEncounter) {
		const bossMonster = {
			id: raidBoss.id,
			name: raidBoss.name,
			biome: 'castle',
			health: raidBoss.maxHealth,
			attack: raidBoss.attack,
			attackChance: raidBoss.attackChance,
			defense: raidBoss.defense,
			defenseChance: raidBoss.defenseChance,
			img: raidBoss.img,
		};

		gameState.currentBattle = {
			playerId,
			monster: bossMonster,
			playerHealth: (playerState.maxHearts || 5) - (playerState.damage || 0),
			monsterHealth: raidBoss.currentHealth,
			battleLog: [
				`A terrifying ${raidBoss.name} stands before the castle gates!`,
				`${playerRows.find(p => p.id === playerId)?.name || 'Player'} vs ${raidBoss.name}`,
			],
			battleActive: true,
			biome,
			ts: Date.now(),
		};
		return true;
	}

	if (!isDeckBiome(biome)) {
		gameState.currentBattle = null;
		return false;
	}

	const deckState = ensureBiomeDeckState(gameState);
	const encounterCard = drawEncounterCard(deckState, biome);

	if (encounterCard.kind !== 'monster') {
		if (encounterCard.kind === 'heart') {
			const extraHeartItem = getExtraHeartItem();
			if (!extraHeartItem) {
				throw serviceError(500, `Missing required item definition: ${REQUIRED_EXTRA_HEART_ITEM_ID}`);
			}
			grantItemToPlayer(playerState, extraHeartItem);
			gameState.recentlyFoundItem = { playerId, item: extraHeartItem, ts: Date.now() };
			addRecentAction(
				gameState,
				'find-item',
				playerRows.find(p => p.id === playerId)?.name || 'Player',
				extraHeartItem.name || 'Additional Heart'
			);
			gameState.currentBattle = null;
			return false;
		}

		grantItemToPlayer(playerState, encounterCard.item);
		gameState.recentlyFoundItem = { playerId, item: encounterCard.item, ts: Date.now() };
		addRecentAction(gameState, 'find-item', playerRows.find(p => p.id === playerId)?.name || 'Player', encounterCard.item.name || 'Item');
		gameState.currentBattle = null;
		return false;
	}


	const encounteredMonster = encounterCard.monster;
	gameState.currentBattle = {
		playerId,
		monster: encounteredMonster,
		playerHealth: (playerState.maxHearts || 5) - (playerState.damage || 0),
		monsterHealth: encounteredMonster.health,
		battleLog: [
			`A wild ${encounteredMonster.name} appeared!`,
			`${playerRows.find(p => p.id === playerId)?.name || 'Player'} vs ${encounteredMonster.name}`,
		],
		battleActive: true,
		biome,
		ts: Date.now(),
	};
	return true;
}

async function movePlayerToTarget(gameId, playerId, targetX, targetY) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');

	const gameState = getGameState(gameRow);
	ensureRaidBossState(gameState);
	ensureGameNotCompleted(gameState);
	const playerRows = await getPlayersByGameId(gameId);
	const player = playerRows.find(p => p.id === playerId);
	if (!player) throw serviceError(404, 'Player not found');
	if (!playerRows[gameState.currentTurn] || playerRows[gameState.currentTurn].id !== playerId) {
		throw serviceError(400, 'Not your turn');
	}

	const validMoveRows = await getValidMovesByGameId(gameId);
	const isValid = validMoveRows.some(m => m.x === targetX && m.y === targetY);
	if (!isValid) throw serviceError(400, 'Invalid move');

	const playerState = getPlayerState(player);
	playerState.positionX = targetX;
	playerState.positionY = targetY;

	const biome = gameState.biomeGrid?.[targetY]?.[targetX] || 'plains';
	if (biome === 'town') {
		playerState.damage = 0;
		addRecentAction(gameState, 'visit-town', player.name || 'Player');
	}

	gameState.recentlyFoundItem = null;
	gameState.currentBattle = null;

	const battleStarted = startEncounterIfNeeded(gameState, playerRows, playerId, playerState, biome);
	if (!battleStarted) {
		gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
	}
	gameState.currentDiceRoll = null;

	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	await updateGameStateJson(gameId, JSON.stringify(gameState));
	await clearValidMovesByGameId(gameId);

	return loadSerializedGame(gameId);
}

async function reconnectPlayer(gameId, playerName) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');
	const playerRow = await getPlayerByGameIdAndName(gameId, playerName);
	if (!playerRow) throw serviceError(404, 'Player not found');
	const gameState = getGameState(gameRow);
	ensureRaidBossState(gameState);
	ensureBiomeDeckState(gameState);
	await updateGameStateJson(gameId, JSON.stringify(gameState));

	const [playerRows, validMoveRows] = await Promise.all([
		getPlayersByGameId(gameId),
		getValidMovesByGameId(gameId),
	]);

	return {
		playerId: playerRow.id,
		gameState: buildGameState({ ...gameRow, gameStateJson: JSON.stringify(gameState) }, playerRows, validMoveRows),
	};
}

export {
	createNewGame,
	joinExistingGame,
	loadSerializedGame,
	rollDiceForPlayer,
	movePlayerToTarget,
	reconnectPlayer,
};
