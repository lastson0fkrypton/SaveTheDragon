import { getHealingAmountDefinition, getItemDefinitionById } from '../config/deckDefinitionsConfig.js';
import type { PlayBiome } from '../config/biomeTypes.js';
import {
	createBiomeDeckRuntime,
	drawLootCard,
	type BiomeDeckRuntime,
	type LootCard,
} from './biomeDeckService.js';
import {
	getGameById,
	getPlayerById,
	getPlayersByGameId,
	updateGameStateJson,
	updatePlayerStateById,
} from '../repositories/gameRepository.js';
import { addRecentAction } from '../utils/gameUtils.js';
import { random } from '../utils/random.js';
import { serviceError } from './serviceErrors.js';
import {
	hasUnequippedItem,
	onBattleLost,
	onBattleWon,
	onConsumableUsed,
} from './questService.js';

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

function applyLootCardToPlayer(playerState, lootCard: LootCard): void {
	ensureInventory(playerState);

	if (lootCard.kind === 'heart') {
		const extraHeartItem = getExtraHeartItemRequired();
		playerState.inventory.items.push(extraHeartItem.id);
		return;
	}

	if (lootCard.item.type === 'weapon') {
		if (!playerState.inventory.weapons.includes(lootCard.item.id)) {
			playerState.inventory.weapons.push(lootCard.item.id);
		}
		return;
	}

	if (lootCard.item.type === 'armor') {
		if (!playerState.inventory.armor.includes(lootCard.item.id)) {
			playerState.inventory.armor.push(lootCard.item.id);
		}
		return;
	}

	playerState.inventory.items.push(lootCard.item.id);
}

function parseJson(text, fallback = {}) {
	if (!text) return fallback;
	try {
		return JSON.parse(text);
	} catch (_error) {
		return fallback;
	}
}

function getGameState(gameRow) {
	return parseJson(gameRow?.gameStateJson, {});
}

function getPlayerState(playerRow) {
	return parseJson(playerRow?.playerStateJson, {});
}

function ensureGameNotCompleted(gameState) {
	if (gameState?.gameCompletion?.completed) {
		throw serviceError(400, 'Game is complete. Start a new game to continue playing.');
	}
}

function isRaidBossBattle(battle) {
	return battle?.monster?.id === 'evil_princess';
}

function movePlayerToNearestTown(gameState, playerState) {
	const biomeGrid = gameState?.biomeGrid;
	if (!biomeGrid) return;

	let minDist = Infinity;
	let tx = playerState.positionX || 0;
	let ty = playerState.positionY || 0;

	for (let y = 0; y < biomeGrid.length; y++) {
		for (let x = 0; x < biomeGrid[0].length; x++) {
			if (biomeGrid[y][x] !== 'town') continue;
			const dist = Math.abs((playerState.positionX || 0) - x) + Math.abs((playerState.positionY || 0) - y);
			if (dist < minDist) {
				minDist = dist;
				tx = x;
				ty = y;
			}
		}
	}

	playerState.positionX = tx;
	playerState.positionY = ty;
}

function findItem(itemId) {
	return getItemDefinitionById(itemId);
}

function isFullHealEffect(effect: unknown): boolean {
	return effect === 'heal_full' || effect === 'full_heal';
}

function getExtraHeartItemRequired() {
	const item = findItem('extra_heart');
	if (!item) {
		throw serviceError(500, 'Missing required item definition: extra_heart');
	}
	return item;
}

function resolveMonsterCounterAttack(battle, playerState, log, playerName) {
	const armorId = playerState.inventory?.equippedArmorId;
	const armor = armorId ? findItem(armorId) : null;
	const monsterHit = random() < (battle.monster.attackChance || 0.5);
	const playerBlock = armor ? random() < (armor.defenseChance || 0) : false;
	let monsterDamage = 0;

	if (monsterHit) {
		monsterDamage = battle.monster.attack || 1;
		if (playerBlock) {
			monsterDamage = Math.max(1, monsterDamage - (armor?.defense || 0));
			log.push(`${playerName} blocks! Damage reduced.`);
		}
		battle.playerHealth -= monsterDamage;
		log.push(`Monster attacks: Hit${monsterDamage > 0 ? ` for ${monsterDamage} damage!` : ''}`);
	} else {
		log.push('Monster attacks: Miss!');
	}

	const maxHearts = playerState.maxHearts || 5;
	playerState.damage = Math.max(0, maxHearts - battle.playerHealth);

	if (battle.playerHealth <= 0) {
		battle.playerHealth = 0;
		log.push(`${playerName} fainted due to injuries.`);
		battle.battleActive = false;
	}
}

async function attackBattle(gameId, playerId) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');

	const gameState = getGameState(gameRow);
	ensureGameNotCompleted(gameState);
	const battle = gameState.currentBattle;
	if (!battle || !battle.battleActive) throw serviceError(400, 'No active battle');
	if (battle.playerId !== playerId) throw serviceError(403, 'Not your battle');

	const playerRow = await getPlayerById(playerId);
	if (!playerRow) throw serviceError(404, 'Player not found');

	const playerState = getPlayerState(playerRow);
	const weaponId = playerState.inventory?.equippedWeaponId || 'fist';
	const weapon = findItem(weaponId) || findItem('fist');
	const log = battle.battleLog || [];

	const playerHit = random() < (weapon?.attackChance || 0.5);
	const monsterBlock = random() < (battle.monster.defenseChance || 0);
	let playerDamage = 0;

	if (playerHit) {
		playerDamage = weapon?.attack || 1;
		if (monsterBlock) {
			playerDamage = Math.max(1, playerDamage - (battle.monster.defense || 0));
			log.push('Monster blocks! Damage reduced.');
		}
		battle.monsterHealth -= playerDamage;
		if (isRaidBossBattle(battle) && gameState.raidBoss) {
			gameState.raidBoss.currentHealth = Math.max(0, battle.monsterHealth);
		}
		log.push(
			`${playerRow.name} attacks with ${weapon?.name || 'Fist'}: Hit${
				playerDamage > 0 ? ` for ${playerDamage} damage!` : ''
			}`
		);
	} else {
		log.push(`${playerRow.name} attacks with ${weapon?.name || 'Fist'}: Miss!`);
	}

	if (battle.monsterHealth <= 0) {
		log.push(`Monster ${battle.monster.name} defeated!`);
		battle.battleActive = false;
		if (isRaidBossBattle(battle) && gameState.raidBoss) {
			gameState.raidBoss.currentHealth = 0;
			gameState.raidBoss.defeated = true;
			gameState.raidBoss.defeatedByPlayerId = playerId;
			gameState.raidBoss.defeatedByPlayerName = playerRow.name;
			gameState.raidBoss.defeatedAtTs = Date.now();
			gameState.gameCompletion = {
				completed: true,
				reason: 'evil_princess_defeated',
				completedByPlayerId: playerId,
				completedByPlayerName: playerRow.name,
				completedAtTs: Date.now(),
			};
			addRecentAction(gameState, 'game-complete', playerRow.name, 'defeated the Evil Princess');
			log.push('The Evil Princess has fallen! The realm is saved.');
			onBattleWon(gameState, playerId, playerRow.name || 'Player', playerState, {
				biome: battle.biome || 'castle',
				monster: battle.monster,
				hadUnequippedItem: hasUnequippedItem(playerState),
				playerSurvived: battle.playerHealth > 0,
			});
		}
	} else {
		resolveMonsterCounterAttack(battle, playerState, log, playerRow.name || 'Player');
	}

	battle.battleLog = log;
	gameState.currentBattle = battle;

	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	await updateGameStateJson(gameId, JSON.stringify(gameState));

	return { success: true, battleLog: log, battleActive: battle.battleActive };
}

async function useBattleItem(gameId, playerId, itemId) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');

	const gameState = getGameState(gameRow);
	ensureGameNotCompleted(gameState);
	const battle = gameState.currentBattle;
	if (!battle || !battle.battleActive) throw serviceError(400, 'No active battle');
	if (battle.playerId !== playerId) throw serviceError(403, 'Not your battle');

	const playerRow = await getPlayerById(playerId);
	if (!playerRow) throw serviceError(404, 'Player not found');
	const playerState = getPlayerState(playerRow);
	ensureInventory(playerState);

	if (!itemId) throw serviceError(400, 'Missing itemId');
	if (!playerState.inventory.items.includes(itemId)) {
		throw serviceError(400, 'Item not in inventory');
	}

	const item = findItem(itemId);
	if (!item || item.type !== 'item') throw serviceError(400, 'Invalid item');
	const healingAmount = getHealingAmountDefinition();
	const effectHeal =
		item.effect === 'heal_small'
			? healingAmount.smallHealthPotion
			: item.effect === 'heal_medium'
				? healingAmount.mediumHealthPotion
				: item.effect === 'heal_large'
					? healingAmount.largeHealthPotion
					: 0;

	const log = battle.battleLog || [];
	let consumed = false;

	if ((typeof item.heal === 'number' && item.heal > 0) || effectHeal > 0) {
		const healValue = typeof item.heal === 'number' && item.heal > 0 ? item.heal : effectHeal;
		battle.playerHealth = Math.min(playerState.maxHearts || 5, battle.playerHealth + healValue);
		playerState.damage = Math.max(0, (playerState.maxHearts || 5) - battle.playerHealth);
		log.push(`${playerRow.name || 'Player'} used ${item.name} and recovered ${healValue} health.`);
		consumed = true;
	} else if (isFullHealEffect(item.effect)) {
		battle.playerHealth = playerState.maxHearts || 5;
		playerState.damage = 0;
		log.push(`${playerRow.name || 'Player'} used ${item.name} and fully healed.`);
		consumed = true;
	} else if (item.effect === 'extra_heart') {
		playerState.maxHearts = Math.min((playerState.maxHearts || 5) + 1, 20);
		battle.playerHealth = Math.min(playerState.maxHearts, battle.playerHealth + 1);
		playerState.damage = Math.max(0, playerState.maxHearts - battle.playerHealth);
		log.push(`${playerRow.name || 'Player'} used ${item.name} and gained a heart.`);
		consumed = true;
	} else if (item.effect === 'teleport') {
		movePlayerToNearestTown(gameState, playerState);
		playerState.damage = 0;
		battle.battleActive = false;
		gameState.currentBattle = null;
		onConsumableUsed(gameState, playerId);
		const usedItemIndex = playerState.inventory.items.indexOf(itemId);
		playerState.inventory.items.splice(usedItemIndex, 1);
		addRecentAction(gameState, 'use-item', playerRow.name || 'Player', item.name || item.id);
		addRecentAction(gameState, 'battle-end', playerRow.name || 'Player', 'teleported away from battle');

		const playerRows = await getPlayersByGameId(gameId);
		gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;

		await updatePlayerStateById(playerId, JSON.stringify(playerState));
		await updateGameStateJson(gameId, JSON.stringify(gameState));
		return { success: true, battleLog: [...log, `${playerRow.name || 'Player'} teleported to town and escaped the battle.`], escaped: true };
	}

	if (!consumed) {
		throw serviceError(400, 'This item cannot be used in battle');
	}

	onConsumableUsed(gameState, playerId);

	const usedItemIndex = playerState.inventory.items.indexOf(itemId);
	playerState.inventory.items.splice(usedItemIndex, 1);
	addRecentAction(gameState, 'use-item', playerRow.name || 'Player', item.name || item.id);

	if (battle.battleActive) {
		resolveMonsterCounterAttack(battle, playerState, log, playerRow.name || 'Player');
	}

	battle.battleLog = log;
	gameState.currentBattle = battle;

	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	await updateGameStateJson(gameId, JSON.stringify(gameState));
	return { success: true, battleLog: log, battleActive: battle.battleActive };
}

async function runFromBattle(gameId, playerId) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');
	const gameState = getGameState(gameRow);
	ensureGameNotCompleted(gameState);
	const battle = gameState.currentBattle;
	if (!battle || !battle.battleActive) throw serviceError(400, 'No active battle');
	if (battle.playerId !== playerId) throw serviceError(403, 'Not your battle');
	throw serviceError(400, 'Run away is disabled. Use a teleport item via battle/use-item or continue fighting.');
}

async function collectBattleLoot(gameId, playerId) {
	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');
	const gameState = getGameState(gameRow);
	const battle = gameState.currentBattle;

	if (
		!battle ||
		battle.playerId !== playerId ||
		battle.monsterHealth > 0 ||
		battle.playerHealth <= 0 ||
		battle.battleActive !== false
	) {
		throw serviceError(400, 'Cannot collect loot unless you have won the battle.');
	}

	const playerRow = await getPlayerById(playerId);
	if (!playerRow) throw serviceError(404, 'Player not found');
	const playerState = getPlayerState(playerRow);

	if (isRaidBossBattle(battle)) {
		if (gameState.raidBoss) {
			gameState.raidBoss.currentHealth = 0;
			gameState.raidBoss.defeated = true;
		}
		gameState.currentBattle = null;
		await updateGameStateJson(gameId, JSON.stringify(gameState));
		return { success: true, reward: null };
	}

	const battleBiome = battle.biome || 'plains';
	const hadUnequippedItem = hasUnequippedItem(playerState);
	let reward: LootCard | null = null;
	if (isDeckBiome(battleBiome)) {
		const deckState = ensureBiomeDeckState(gameState);
		reward = drawLootCard(deckState, battleBiome);
		applyLootCardToPlayer(playerState, reward);
		if (reward.kind === 'heart') {
			const extraHeartItem = getExtraHeartItemRequired();
			gameState.recentlyFoundItem = { playerId, item: extraHeartItem, ts: Date.now() };
		} else {
			gameState.recentlyFoundItem = { playerId, item: reward.item, ts: Date.now() };
		}
	} else {
		gameState.recentlyFoundItem = null;
	}
	addRecentAction(gameState, 'battle-end', playerRow.name, `defeated ${battle.monster?.name || 'a monster'}`);
	onBattleWon(gameState, playerId, playerRow.name || 'Player', playerState, {
		biome: battleBiome,
		monster: battle.monster,
		hadUnequippedItem,
		playerSurvived: battle.playerHealth > 0,
	});

	const playerRows = await getPlayersByGameId(gameId);
	gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
	gameState.currentBattle = null;

	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	await updateGameStateJson(gameId, JSON.stringify(gameState));

	return { success: true, reward };
}

async function returnPlayerToTown(gameId, playerId) {
	const playerRow = await getPlayerById(playerId);
	if (!playerRow) throw serviceError(404, 'Player not found');
	const playerState = getPlayerState(playerRow);

	const gameRow = await getGameById(gameId);
	if (!gameRow) throw serviceError(404, 'Game not found');
	const gameState = getGameState(gameRow);
	ensureGameNotCompleted(gameState);
	const battle = gameState.currentBattle;

	if (!battle || battle.playerId !== playerId || battle.playerHealth > 0 || battle.battleActive !== false) {
		throw serviceError(400, 'Cannot return to town unless you have lost the battle.');
	}
	onBattleLost(gameState, playerId);
	if (isRaidBossBattle(battle) && gameState.raidBoss) {
		gameState.raidBoss.currentHealth = Math.max(0, battle.monsterHealth);
	}

	movePlayerToNearestTown(gameState, playerState);

	playerState.damage = 0;
	addRecentAction(gameState, 'battle-end', playerRow.name, 'returned to town after fainting');

	const playerRows = await getPlayersByGameId(gameId);
	gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
	gameState.currentBattle = null;

	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	await updateGameStateJson(gameId, JSON.stringify(gameState));

	return { success: true, returnedToTown: true };
}

export { attackBattle, useBattleItem, runFromBattle, collectBattleLoot, returnPlayerToTown };
