import { getDeckDefinitionsConfig } from '../config/deckDefinitionsConfig.js';
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

function toGroupLabel(group: string) {
	return group
		.split('_')
		.map(part => (part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
		.join(' ');
}

function getVariantRank(variant: unknown): number {
	if (variant === 'cracked') return 0;
	if (variant === 'normal') return 1;
	if (variant === 'enchanted') return 2;
	if (variant === 'weak') return 1;
	if (variant === 'strong') return 2;
	return 0;
}

function inferBaseId(itemId: string): string {
	if (itemId.startsWith('cracked_')) return itemId.replace(/^cracked_/, '');
	if (itemId.startsWith('enchanted_')) return itemId.replace(/^enchanted_/, '');
	return itemId;
}

function getAdminDeckItemOptions() {
	const config = getDeckDefinitionsConfig();
	if (!config?.decks) return [];

	const options = [];
	for (const [deckId, deck] of Object.entries(config.decks)) {
		for (const card of deck.cards || []) {
			if (!card || card.kind !== 'item' || typeof card.id !== 'string') continue;
			const rawCard = card as Record<string, unknown>;
			const inferredType =
				rawCard.type === 'weapon' || rawCard.type === 'armor' || rawCard.type === 'item'
					? rawCard.type
					: typeof rawCard.attack === 'number' || typeof rawCard.attackChance === 'number'
						? 'weapon'
						: typeof rawCard.defense === 'number' || typeof rawCard.defenseChance === 'number'
							? 'armor'
							: 'item';

			options.push({
				group: deckId,
				id: card.id,
				name: typeof rawCard.name === 'string' && rawCard.name.length > 0 ? rawCard.name : card.id,
				type: inferredType,
				variant: typeof rawCard.variant === 'string' ? rawCard.variant : null,
				baseId: typeof rawCard.baseId === 'string' ? rawCard.baseId : null,
			});
		}
	}

	const seen = new Set();
	const deduped = options.filter(option => {
		const key = `${option.group}:${option.id}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	return deduped
		.map(option => ({
			...option,
			groupLabel: toGroupLabel(option.group),
		}))
		.sort((left, right) => {
			if (left.group !== right.group) return left.group.localeCompare(right.group);
			const leftBase = left.baseId || inferBaseId(left.id);
			const rightBase = right.baseId || inferBaseId(right.id);
			if (leftBase !== rightBase) return leftBase.localeCompare(rightBase);
			const variantDiff = getVariantRank(left.variant) - getVariantRank(right.variant);
			if (variantDiff !== 0) return variantDiff;
			return left.name.localeCompare(right.name);
		});
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
	return getAdminDeckItemOptions();
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

	const adminItem = getAdminDeckItemOptions().find(option => option.id === itemId);
	if (!adminItem) throw serviceError(400, 'Invalid itemId for configured decks');

	const playerState = parseJson(playerRow.playerStateJson);
	if (!playerState.inventory) {
		playerState.inventory = { weapons: [], armor: [], items: [], equippedWeaponId: null, equippedArmorId: null };
	}
	if (!Array.isArray(playerState.inventory.weapons)) playerState.inventory.weapons = [];
	if (!Array.isArray(playerState.inventory.armor)) playerState.inventory.armor = [];
	if (!Array.isArray(playerState.inventory.items)) playerState.inventory.items = [];

	if (adminItem.type === 'weapon') {
		if (!playerState.inventory.weapons.includes(adminItem.id)) {
			playerState.inventory.weapons.push(adminItem.id);
		}
	} else if (adminItem.type === 'armor') {
		if (!playerState.inventory.armor.includes(adminItem.id)) {
			playerState.inventory.armor.push(adminItem.id);
		}
	} else {
		playerState.inventory.items.push(adminItem.id);
	}

	const gameState = parseJson(gameRow.gameStateJson);
	addRecentAction(gameState, 'admin-give-item', playerRow.name, adminItem.name);

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
