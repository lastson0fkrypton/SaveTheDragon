import { CHARACTERS } from '../constants/characters.js';
import { getHealingAmountDefinition, getItemDefinitionById, getLootDeckTypesForItemId } from '../config/deckDefinitionsConfig.js';
import { getDeckTypeForBiome, type DeckType, type PlayBiome } from '../config/biomeTypes.js';
import {
	createBiomeDeckRuntime,
	type BiomeDeckRuntime,
	type LootCard,
} from './biomeDeckService.js';
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

function isFullHealEffect(effect: unknown): boolean {
	return effect === 'heal_full' || effect === 'full_heal';
}

function ensureBiomeDeckState(gameState): BiomeDeckRuntime {
	if (!gameState.biomeDecks) {
		gameState.biomeDecks = createBiomeDeckRuntime();
	}
	return gameState.biomeDecks as BiomeDeckRuntime;
}

function toPlayBiome(value: unknown): PlayBiome | null {
	if (value === 'plains' || value === 'forest' || value === 'desert' || value === 'cave' || value === 'volcano') {
		return value;
	}
	return null;
}

function resolveDeckTypeForDiscard(itemId: string, gameState, playerState): DeckType | null {
	const configuredDeckTypes = getLootDeckTypesForItemId(itemId);
	if (configuredDeckTypes.length === 1) {
		return configuredDeckTypes[0];
	}

	const grid = gameState?.biomeGrid;
	const x = playerState?.positionX;
	const y = playerState?.positionY;
	if (
		Array.isArray(grid) &&
		typeof x === 'number' &&
		typeof y === 'number' &&
		grid[y] &&
		typeof grid[y][x] === 'string'
	) {
		const biome = toPlayBiome(grid[y][x]);
		if (!biome) return null;
		const deckType = getDeckTypeForBiome(biome);
		if (configuredDeckTypes.length === 0 || configuredDeckTypes.includes(deckType)) {
			return deckType;
		}
	}

	return configuredDeckTypes[0] ?? null;
}

function pushDiscardedItemToDeck(gameState, deckType: DeckType, item): void {
	const runtime = ensureBiomeDeckState(gameState);
	const deckState = runtime[deckType];
	if (!deckState) {
		throw serviceError(500, `Missing deck state for deck type '${deckType}'`);
	}

	const card: LootCard =
		item.type === 'item'
			? { kind: 'consumable', item }
			: { kind: 'item', item };

	if (!Array.isArray(deckState.lootDiscard)) {
		deckState.lootDiscard = [];
	}
	deckState.lootDiscard.push(card);
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
	if (isFullHealEffect(item.effect)) {
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

async function discardItem(gameId, playerId, itemId) {
	const [playerRow, gameRow] = await Promise.all([
		getPlayerByIdAndGameId(playerId, gameId),
		getGameById(gameId),
	]);
	if (!playerRow) throw serviceError(404, 'Player not found');
	if (!gameRow) throw serviceError(404, 'Game not found');

	const playerState = parseJson(playerRow.playerStateJson);
	if (!playerState.inventory) {
		throw serviceError(400, 'Inventory not available');
	}

	const item = findItem(itemId);
	if (!item) throw serviceError(400, 'Invalid item');
	if (itemId === 'fist') throw serviceError(400, 'Cannot discard fist');
	if (playerState.inventory.equippedWeaponId === itemId || playerState.inventory.equippedArmorId === itemId) {
		throw serviceError(400, 'Cannot discard equipped item');
	}

	const gameState = parseJson(gameRow.gameStateJson);
	let removed = false;

	if (item.type === 'weapon' && Array.isArray(playerState.inventory.weapons)) {
		const index = playerState.inventory.weapons.indexOf(itemId);
		if (index >= 0) {
			playerState.inventory.weapons.splice(index, 1);
			removed = true;
		}
	} else if (item.type === 'armor' && Array.isArray(playerState.inventory.armor)) {
		const index = playerState.inventory.armor.indexOf(itemId);
		if (index >= 0) {
			playerState.inventory.armor.splice(index, 1);
			removed = true;
		}
	} else if (item.type === 'item' && Array.isArray(playerState.inventory.items)) {
		const index = playerState.inventory.items.indexOf(itemId);
		if (index >= 0) {
			playerState.inventory.items.splice(index, 1);
			removed = true;
		}
	}

	if (!removed) {
		throw serviceError(400, 'Item not in inventory');
	}

	const deckType = resolveDeckTypeForDiscard(item.id, gameState, playerState);
	if (!deckType) {
		throw serviceError(400, 'This item cannot be discarded to a loot deck');
	}

	pushDiscardedItemToDeck(gameState, deckType, item);
	addRecentAction(gameState, 'discard-item', playerRow.name, item.name || item.id);

	await Promise.all([
		updatePlayerStateById(playerId, JSON.stringify(playerState)),
		updateGameStateJson(gameId, JSON.stringify(gameState)),
	]);

	return { success: true };
}

export { listCharacters, updateCharacter, equipItem, useItem, discardItem };
