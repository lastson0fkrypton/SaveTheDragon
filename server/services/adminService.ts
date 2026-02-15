import { ITEM_DEFS } from '../constants/items.js';
import {
	clearGameDataById,
	clearValidMovesByGameId,
	deletePlayerByIdAndGameId,
	getAllGames,
	getAllPlayers,
	getGameById,
	getPlayerByIdAndGameId,
	getPlayersByGameId,
	updateGameStateJson,
	updatePlayerStateByIdAndGameId,
} from '../repositories/gameRepository.js';
import { addRecentAction } from '../utils/gameUtils.js';
import { serviceError } from './serviceErrors.js';

const ADMIN_PASSWORD = 'superman';

function assertAdmin(password) {
	if (password !== ADMIN_PASSWORD) {
		throw serviceError(403, 'Forbidden');
	}
}

function parseJson(text, fallback = {}) {
	if (!text) return fallback;
	try {
		return JSON.parse(text);
	} catch (_error) {
		return fallback;
	}
}

function findItemDef(itemId) {
	return ITEM_DEFS.find(item => item.id === itemId) || null;
}

async function listAdminGames(password) {
	assertAdmin(password);
	const [gameRows, playerRows] = await Promise.all([getAllGames(), getAllPlayers()]);
	return gameRows.map(gameRow => ({
		...(function () {
			const gameState = parseJson(gameRow.gameStateJson);
			const players = playerRows.filter(p => p.gameId === gameRow.id);
			return {
				gameId: gameRow.id,
				players: players.map(p => ({ id: p.id, name: p.name })),
				currentTurn: players[gameState.currentTurn]?.name || null,
				currentDiceRoll: gameState.currentDiceRoll ?? null,
				preventExpiry: Boolean(gameState.preventExpiry),
			};
		})(),
	}));
}

async function deleteAdminGame(gameId, password) {
	assertAdmin(password);
	await clearGameDataById(gameId);
	return { success: true };
}

async function listAdminItems(password) {
	assertAdmin(password);
	return ITEM_DEFS.map(item => ({
		id: item.id,
		name: item.name,
		type: item.type,
		biome: item.biome || 'any',
	}));
}

async function setAdminGamePreventExpiry(gameId, password, preventExpiry) {
	assertAdmin(password);
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');
	const gameState = parseJson(gameRow.gameStateJson);
	gameState.preventExpiry = Boolean(preventExpiry);
	await updateGameStateJson(gameId, JSON.stringify(gameState));
	return { success: true, preventExpiry: gameState.preventExpiry };
}

async function kickAdminPlayer(gameId, playerId, password) {
	assertAdmin(password);
	const [gameRow, playerRow, playerRows] = await Promise.all([
		getGameById(gameId),
		getPlayerByIdAndGameId(playerId, gameId),
		getPlayersByGameId(gameId),
	]);
	if (!gameRow) throw serviceError(404, 'Game not found');
	if (!playerRow) throw serviceError(404, 'Player not found');

	const kickedIndex = playerRows.findIndex(player => player.id === playerId);
	if (kickedIndex < 0) throw serviceError(404, 'Player not found');

	await deletePlayerByIdAndGameId(playerId, gameId);

	if (playerRows.length <= 1) {
		await clearGameDataById(gameId);
		return { success: true, gameDeleted: true };
	}

	const remainingCount = playerRows.length - 1;
	const gameState = parseJson(gameRow.gameStateJson);
	if (typeof gameState.currentTurn !== 'number') {
		gameState.currentTurn = 0;
	}
	if (gameState.currentTurn > kickedIndex) {
		gameState.currentTurn -= 1;
	}
	if (gameState.currentTurn >= remainingCount) {
		gameState.currentTurn = 0;
	}
	if (gameState.currentBattle?.playerId === playerId) {
		gameState.currentBattle = null;
		gameState.currentDiceRoll = null;
	}

	await updateGameStateJson(gameId, JSON.stringify(gameState));
	await clearValidMovesByGameId(gameId);
	return { success: true };
}

async function giveAdminPlayerItem(gameId, playerId, password, itemId) {
	assertAdmin(password);
	if (!itemId) throw serviceError(400, 'Missing itemId');

	const [gameRow, playerRow] = await Promise.all([getGameById(gameId), getPlayerByIdAndGameId(playerId, gameId)]);
	if (!gameRow) throw serviceError(404, 'Game not found');
	if (!playerRow) throw serviceError(404, 'Player not found');

	const itemDef = findItemDef(itemId);
	if (!itemDef) throw serviceError(400, 'Invalid itemId');

	const playerState = parseJson(playerRow.playerStateJson);
	if (!playerState.inventory) {
		playerState.inventory = { weapons: [], armor: [], items: [], equippedWeaponId: null, equippedArmorId: null };
	}
	if (!Array.isArray(playerState.inventory.weapons)) playerState.inventory.weapons = [];
	if (!Array.isArray(playerState.inventory.armor)) playerState.inventory.armor = [];
	if (!Array.isArray(playerState.inventory.items)) playerState.inventory.items = [];

	if (itemDef.type === 'weapon') {
		if (!playerState.inventory.weapons.includes(itemDef.id)) {
			playerState.inventory.weapons.push(itemDef.id);
		}
	} else if (itemDef.type === 'armor') {
		if (!playerState.inventory.armor.includes(itemDef.id)) {
			playerState.inventory.armor.push(itemDef.id);
		}
	} else {
		playerState.inventory.items.push(itemDef.id);
	}

	const gameState = parseJson(gameRow.gameStateJson);
	addRecentAction(gameState, 'admin-give-item', playerRow.name, itemDef.name);

	await Promise.all([
		updatePlayerStateByIdAndGameId(playerId, gameId, JSON.stringify(playerState)),
		updateGameStateJson(gameId, JSON.stringify(gameState)),
	]);

	return { success: true };
}

export {
	listAdminGames,
	deleteAdminGame,
	listAdminItems,
	setAdminGamePreventExpiry,
	kickAdminPlayer,
	giveAdminPlayerItem,
};
