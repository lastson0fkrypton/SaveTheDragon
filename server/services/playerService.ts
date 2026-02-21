import { CHARACTERS } from '../constants/characters.js';
import { getHealingAmountDefinition, getItemDefinitionById } from '../config/deckDefinitionsConfig.js';
import {
	getGameById,
	getPlayerByIdAndGameId,
	updateGameStateJson,
	updatePlayerStateById,
	updatePlayerStateByIdAndGameId,
} from '../repositories/gameRepository.js';
import { addRecentAction } from '../utils/gameUtils.js';
import { serviceError } from './serviceErrors.js';

function parseJson(text, fallback = {}) {
	if (!text) return fallback;
	try {
		return JSON.parse(text);
	} catch (_error) {
		return fallback;
	}
}

function findItem(itemId) {
	return getItemDefinitionById(itemId);
}

function nearestTownPosition(biomeGrid, positionX, positionY) {
	let minDist = Infinity;
	let targetX = positionX;
	let targetY = positionY;
	for (let y = 0; y < biomeGrid.length; y++) {
		for (let x = 0; x < biomeGrid[0].length; x++) {
			if (biomeGrid[y][x] === 'town') {
				const dist = Math.abs(positionX - x) + Math.abs(positionY - y);
				if (dist < minDist) {
					minDist = dist;
					targetX = x;
					targetY = y;
				}
			}
		}
	}
	return { x: targetX, y: targetY };
}

async function listCharacters() {
	return CHARACTERS;
}

async function updateCharacter(gameId, playerId, characterId) {
	const playerRow = await getPlayerByIdAndGameId(playerId, gameId);
	if (!playerRow) throw serviceError(404, 'Player not found');
	const playerState = parseJson(playerRow.playerStateJson);
	playerState.characterId = characterId;
	await updatePlayerStateByIdAndGameId(playerId, gameId, JSON.stringify(playerState));
	return { success: true };
}

async function equipItem(gameId, playerId, itemId) {
	const playerRow = await getPlayerByIdAndGameId(playerId, gameId);
	if (!playerRow) throw serviceError(404, 'Player not found');
	const playerState = parseJson(playerRow.playerStateJson);
	const item = findItem(itemId);
	if (!item) throw serviceError(400, 'Invalid item');

	if (item.type === 'weapon' && playerState.inventory.weapons.includes(itemId)) {
		playerState.inventory.equippedWeaponId = itemId;
	} else if (item.type === 'armor' && playerState.inventory.armor.includes(itemId)) {
		playerState.inventory.equippedArmorId = itemId;
	} else {
		throw serviceError(400, 'Item not in inventory');
	}

	const gameRow = await getGameById(gameId);
	if (gameRow) {
		const gameState = parseJson(gameRow.gameStateJson);
		addRecentAction(gameState, 'equip', playerRow.name, item.name);
		await updateGameStateJson(gameId, JSON.stringify(gameState));
	}

	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	return { success: true };
}

async function useItem(gameId, playerId, itemId) {
	const playerRow = await getPlayerByIdAndGameId(playerId, gameId);
	if (!playerRow) throw serviceError(404, 'Player not found');
	const playerState = parseJson(playerRow.playerStateJson);

	if (!playerState.inventory.items.includes(itemId)) {
		throw serviceError(400, 'Item not in inventory');
	}
	const item = findItem(itemId);
	if (!item || item.type !== 'item') throw serviceError(400, 'Invalid item');

	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');
	const gameState = parseJson(gameRow.gameStateJson);
	if (gameState.currentBattle?.battleActive && gameState.currentBattle?.playerId === playerId) {
		throw serviceError(400, 'Use /battle/use-item while in an active battle.');
	}

	let used = false;
	const healingAmount = getHealingAmountDefinition();
	const effectHeal =
		item.effect === 'heal_small'
			? healingAmount.smallHealthPotion
			: item.effect === 'heal_medium'
				? healingAmount.mediumHealthPotion
				: item.effect === 'heal_large'
					? healingAmount.largeHealthPotion
					: 0;
	if (item.effect === 'heal_full') {
		playerState.damage = 0;
		used = true;
	} else if ((typeof item.heal === 'number' && item.heal > 0) || effectHeal > 0) {
		const healValue = typeof item.heal === 'number' && item.heal > 0 ? item.heal : effectHeal;
		playerState.damage = Math.max(0, (playerState.damage || 0) - healValue);
		used = true;
	} else if (item.effect === 'extra_heart') {
		playerState.maxHearts = Math.min((playerState.maxHearts || 5) + 1, 20);
		used = true;
	} else if (item.effect === 'teleport') {
		const biomeGrid = gameState.biomeGrid;
		if (biomeGrid) {
			const next = nearestTownPosition(biomeGrid, playerState.positionX, playerState.positionY);
			playerState.positionX = next.x;
			playerState.positionY = next.y;
			used = true;
		}
	}

	if (!used) throw serviceError(400, 'Item cannot be used');

	const usedItemIndex = playerState.inventory.items.indexOf(itemId);
	if (usedItemIndex < 0) throw serviceError(400, 'Item not in inventory');
	playerState.inventory.items.splice(usedItemIndex, 1);
	addRecentAction(gameState, 'use-item', playerRow.name, item.name);

	await updateGameStateJson(gameId, JSON.stringify(gameState));
	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	return { success: true };
}

export { listCharacters, updateCharacter, equipItem, useItem };
