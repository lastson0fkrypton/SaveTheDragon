import { getDeckDefinitionsConfig, getItemDefinitionById, getLootDeckTypesForItemId } from '../config/deckDefinitionsConfig.js';
import { createBiomeDeckRuntime } from './biomeDeckService.js';
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

function toDeckTypeFromDeckGroup(group) {
	if (typeof group !== 'string') return null;
	if (group.startsWith('easy_')) return 'easy';
	if (group.startsWith('medium_')) return 'medium';
	if (group.startsWith('hard_')) return 'hard';
	return null;
}

function ensureBiomeDeckState(gameState) {
	if (!gameState.biomeDecks) {
		gameState.biomeDecks = createBiomeDeckRuntime();
	}
	return gameState.biomeDecks;
}

function removeGrantedItemFromDeck(gameState, itemId, deckGroupHint = null) {
	const itemDef = getItemDefinitionById(itemId);
	if (!itemDef) return;

	const hintedDeckType = toDeckTypeFromDeckGroup(deckGroupHint);
	const candidateDeckTypes = [
		...(hintedDeckType ? [hintedDeckType] : []),
		...getLootDeckTypesForItemId(itemId),
	];
	if (candidateDeckTypes.length === 0) return;

	const biomeDecks = ensureBiomeDeckState(gameState);
	for (const deckType of candidateDeckTypes) {
		const deckState = biomeDecks?.[deckType];
		if (!deckState || !Array.isArray(deckState.loot)) continue;

		const foundIndex = deckState.loot.findIndex(card => {
			if (!card || (card.kind !== 'item' && card.kind !== 'consumable')) return false;
			return card.item?.id === itemId;
		});
		if (foundIndex < 0) continue;

		deckState.loot.splice(foundIndex, 1);
		return;
	}
}

function toAdminItemSnapshot(itemId, fallbackType = null) {
	const item = getItemDefinitionById(itemId);
	return {
		id: itemId,
		name: item?.name || itemId,
		type: item?.type || fallbackType,
		attack: typeof item?.attack === 'number' ? item.attack : null,
		attackChance: typeof item?.attackChance === 'number' ? item.attackChance : null,
		defense: typeof item?.defense === 'number' ? item.defense : null,
		defenseChance: typeof item?.defenseChance === 'number' ? item.defenseChance : null,
		heal: typeof item?.heal === 'number' ? item.heal : null,
		effect: typeof item?.effect === 'string' ? item.effect : null,
	};
}

function buildPlayerInventorySnapshot(playerRow) {
	const playerState = parseJson(playerRow.playerStateJson);
	const inventory = playerState?.inventory || {};
	const weapons = Array.isArray(inventory.weapons) ? inventory.weapons : [];
	const armor = Array.isArray(inventory.armor) ? inventory.armor : [];
	const items = Array.isArray(inventory.items) ? inventory.items : [];
	const equippedWeaponId = typeof inventory.equippedWeaponId === 'string' ? inventory.equippedWeaponId : null;
	const equippedArmorId = typeof inventory.equippedArmorId === 'string' ? inventory.equippedArmorId : null;

	return {
		id: playerRow.id,
		name: playerRow.name,
		equippedWeaponId,
		equippedArmorId,
		cards: {
			weapons: weapons.map(itemId => ({ ...toAdminItemSnapshot(itemId, 'weapon'), equipped: itemId === equippedWeaponId })),
			armor: armor.map(itemId => ({ ...toAdminItemSnapshot(itemId, 'armor'), equipped: itemId === equippedArmorId })),
			items: items.map(itemId => toAdminItemSnapshot(itemId, 'item')),
		},
	};
}

function toRuntimeDiscardCard(card, source) {
	if (!card || typeof card !== 'object') {
		return {
			source,
			kind: 'item',
			id: `${source}_unknown`,
			name: 'Unknown Card',
			type: null,
			attack: null,
			attackChance: null,
			defense: null,
			defenseChance: null,
			health: null,
			heal: null,
			effect: null,
			hearts: null,
		};
	}

	if (card.kind === 'monster' && card.monster && typeof card.monster === 'object') {
		return toAdminDeckCard({
			kind: 'monster',
			id: card.monster.id,
			name: card.monster.name,
			variant: card.monsterVariant,
			img: card.monster.img,
			health: card.monster.health,
			attack: card.monster.attack,
			attackChance: card.monster.attackChance,
			defense: card.monster.defense,
			defenseChance: card.monster.defenseChance,
		}, source);
	}

	if ((card.kind === 'item' || card.kind === 'consumable') && card.item && typeof card.item === 'object') {
		return toAdminDeckCard({
			kind: 'item',
			id: card.item.id,
			name: card.item.name,
			type: card.item.type,
			img: card.item.img,
			attack: card.item.attack,
			attackChance: card.item.attackChance,
			defense: card.item.defense,
			defenseChance: card.item.defenseChance,
			heal: card.item.heal,
			effect: card.item.effect,
		}, source);
	}

	if (card.kind === 'heart') {
		return toAdminDeckCard({
			kind: 'heart',
			id: card.id || 'extra_heart',
			hearts: typeof card.hearts === 'number' ? card.hearts : 1,
			name: 'Additional Heart',
		}, source);
	}

	if (card.kind === 'chest') {
		return toAdminDeckCard({
			kind: 'chest',
			id: typeof card.id === 'string' ? card.id : `${source}_chest`,
		}, source);
	}

	return toAdminDeckCard({
		kind: 'item',
		id: typeof card.id === 'string' ? card.id : `${source}_unknown`,
		name: typeof card.name === 'string' ? card.name : 'Unknown Card',
		type: card.type === 'weapon' || card.type === 'armor' || card.type === 'item' ? card.type : null,
		attack: typeof card.attack === 'number' ? card.attack : null,
		attackChance: typeof card.attackChance === 'number' ? card.attackChance : null,
		defense: typeof card.defense === 'number' ? card.defense : null,
		defenseChance: typeof card.defenseChance === 'number' ? card.defenseChance : null,
		heal: typeof card.heal === 'number' ? card.heal : null,
		effect: typeof card.effect === 'string' ? card.effect : null,
	}, source);
}

function buildDiscardSnapshots(gameState) {
	const biomeDecks = gameState?.biomeDecks;
	if (!biomeDecks || typeof biomeDecks !== 'object') {
		return {};
	}

	const byDeck = {
		easy: biomeDecks.easy,
		medium: biomeDecks.medium,
		hard: biomeDecks.hard,
	};

	const snapshots = {};
	for (const [deckId, deckState] of Object.entries(byDeck)) {
		const encounterDiscardRaw = Array.isArray(deckState?.encounterDiscard) ? deckState.encounterDiscard : [];
		const lootDiscardRaw = Array.isArray(deckState?.lootDiscard) ? deckState.lootDiscard : [];
		snapshots[deckId] = {
			deckId,
			encounterDiscardCount: encounterDiscardRaw.length,
			lootDiscardCount: lootDiscardRaw.length,
			encounterDiscard: encounterDiscardRaw.map(card => toRuntimeDiscardCard(card, 'encounter-discard')),
			lootDiscard: lootDiscardRaw.map(card => toRuntimeDiscardCard(card, 'loot-discard')),
		};
	}

	return snapshots;
}

const CONSUMABLE_ID_BY_KEY = {
	teleport: 'teleport',
	smallHealthPotion: 'small_potion',
	mediumHealthPotion: 'medium_potion',
	largeHealthPotion: 'large_potion',
	fullHealthPotion: 'full_potion',
} as const;

function toAdminDeckCard(rawCard, source, repeat = 1) {
	const kind = typeof rawCard.kind === 'string' ? rawCard.kind : 'item';
	const card = {
		source,
		repeat,
		kind,
		id: typeof rawCard.id === 'string' ? rawCard.id : `${source}_${repeat}`,
		name: typeof rawCard.name === 'string' && rawCard.name.length > 0 ? rawCard.name : undefined,
		variant: typeof rawCard.variant === 'string' ? rawCard.variant : null,
		type:
			rawCard.type === 'weapon' || rawCard.type === 'armor' || rawCard.type === 'item'
				? rawCard.type
				: null,
		attack: typeof rawCard.attack === 'number' ? rawCard.attack : null,
		attackChance: typeof rawCard.attackChance === 'number' ? rawCard.attackChance : null,
		defense: typeof rawCard.defense === 'number' ? rawCard.defense : null,
		defenseChance: typeof rawCard.defenseChance === 'number' ? rawCard.defenseChance : null,
		health: typeof rawCard.health === 'number' ? rawCard.health : null,
		heal: typeof rawCard.heal === 'number' ? rawCard.heal : null,
		effect: typeof rawCard.effect === 'string' ? rawCard.effect : null,
		hearts: typeof rawCard.hearts === 'number' ? rawCard.hearts : null,
	};

	if (!card.name) {
		if (kind === 'heart') {
			card.name = 'Additional Heart';
		} else if (kind === 'chest') {
			card.name = 'Chest';
		} else {
			card.name = card.id;
		}
	}

	return card;
}

function buildAdminDeckSnapshots() {
	const config = getDeckDefinitionsConfig();
	if (!config?.decks) return {};

	const snapshots = {};
	for (const [deckId, deck] of Object.entries(config.decks)) {
		const explicitCards = (deck.cards || []).map(card => toAdminDeckCard(card, 'card'));
		const expandedConsumables = [];
		const hasExplicitChestCards = explicitCards.some(card => card.kind === 'chest');

		for (const [countKey, itemId] of Object.entries(CONSUMABLE_ID_BY_KEY)) {
			const count = Math.max(0, Math.floor(deck.consumables?.[countKey] || 0));
			if (count <= 0) continue;
			const itemDef = getItemDefinitionById(itemId);
			for (let index = 0; index < count; index += 1) {
				expandedConsumables.push(
					toAdminDeckCard(
						{
							kind: 'item',
							id: itemId,
							name: itemDef?.name || itemId,
							type: 'item',
							effect: itemDef?.effect ?? null,
							heal: itemDef?.heal ?? null,
						},
						'consumable',
						index + 1
					)
				);
			}
		}

		const extraHeartCount = Math.max(0, Math.floor(deck.consumables?.extraHeart || 0));
		for (let index = 0; index < extraHeartCount; index += 1) {
			expandedConsumables.push(toAdminDeckCard({ kind: 'heart', id: 'extra_heart', hearts: 1, name: 'Additional Heart' }, 'consumable', index + 1));
		}

		const chestCount = Math.max(0, Math.floor(deck.consumables?.chest || 0));
		if (!hasExplicitChestCards) {
			for (let index = 0; index < chestCount; index += 1) {
				expandedConsumables.push(toAdminDeckCard({ kind: 'chest', id: `${deckId}_consumable_chest_${index + 1}` }, 'consumable', index + 1));
			}
		}

		snapshots[deckId] = {
			deckId,
			explicitCount: explicitCards.length,
			consumableCount: expandedConsumables.length,
			totalCount: explicitCards.length + expandedConsumables.length,
			cards: [...explicitCards, ...expandedConsumables],
		};
	}

	return snapshots;
}

function buildLiveDeckSnapshots(gameState) {
	const biomeDecks = gameState?.biomeDecks;
	if (!biomeDecks || typeof biomeDecks !== 'object') {
		return buildAdminDeckSnapshots();
	}

	const isConsumableRuntimeCard = card =>
		Boolean(card) && typeof card === 'object' && (card.kind === 'consumable' || card.kind === 'heart' || card.kind === 'chest');

	const toLiveAdminCard = card =>
		toRuntimeDiscardCard(card, isConsumableRuntimeCard(card) ? 'consumable' : 'card');

	const snapshots = {};
	const runtimeByDeck = {
		easy: biomeDecks.easy,
		medium: biomeDecks.medium,
		hard: biomeDecks.hard,
	};

	for (const [deckType, deckState] of Object.entries(runtimeByDeck)) {
		const encounterCardsRaw = Array.isArray(deckState?.encounter) ? deckState.encounter : [];
		const lootCardsRaw = Array.isArray(deckState?.loot) ? deckState.loot : [];
		const encounterCards = encounterCardsRaw.map(toLiveAdminCard);
		const lootCards = lootCardsRaw.map(toLiveAdminCard);
		const encounterConsumableCount = encounterCardsRaw.filter(isConsumableRuntimeCard).length;
		const lootConsumableCount = lootCardsRaw.filter(isConsumableRuntimeCard).length;

		snapshots[`${deckType}_encounter`] = {
			deckId: `${deckType}_encounter`,
			explicitCount: encounterCardsRaw.length - encounterConsumableCount,
			consumableCount: encounterConsumableCount,
			totalCount: encounterCardsRaw.length,
			cards: encounterCards,
		};

		snapshots[`${deckType}_loot`] = {
			deckId: `${deckType}_loot`,
			explicitCount: lootCardsRaw.length - lootConsumableCount,
			consumableCount: lootConsumableCount,
			totalCount: lootCardsRaw.length,
			cards: lootCards,
		};
	}

	return snapshots;
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
			const playerSnapshots = players.map(buildPlayerInventorySnapshot);
			return {
				gameId: gameRow.id,
				players: playerSnapshots,
				currentTurn: players[gameState.currentTurn]?.name || null,
				currentDiceRoll: gameState.currentDiceRoll ?? null,
				preventExpiry: Boolean(gameState.preventExpiry),
				deckSnapshots: buildLiveDeckSnapshots(gameState),
				discardSnapshots: buildDiscardSnapshots(gameState),
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
	removeGrantedItemFromDeck(gameState, adminItem.id, adminItem.group);
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
