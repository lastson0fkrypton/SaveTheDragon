import { getItemDefs } from '../constants/items.js';
import {
	getGameById,
	getPlayerById,
	getPlayersByGameId,
	updateGameStateJson,
	updatePlayerStateById,
} from '../repositories/gameRepository.js';
import { addRecentAction, getRandomItemForBiome } from '../utils/gameUtils.js';
import { random } from '../utils/random.js';
import { serviceError } from './serviceErrors.js';

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
	return getItemDefs().find(i => i.id === itemId);
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
			playerDamage = Math.max(0, playerDamage - (battle.monster.defense || 0));
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
		}
	} else {
		const armorId = playerState.inventory?.equippedArmorId;
		const armor = armorId ? findItem(armorId) : null;
		const monsterHit = random() < (battle.monster.attackChance || 0.5);
		const playerBlock = armor ? random() < (armor.defenseChance || 0) : false;
		let monsterDamage = 0;

		if (monsterHit) {
			monsterDamage = battle.monster.attack || 1;
			if (playerBlock) {
				monsterDamage = Math.max(0, monsterDamage - (armor?.defense || 0));
				log.push(`${playerRow.name} blocks! Damage reduced.`);
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
			log.push(`${playerRow.name} fainted due to injuries.`);
			battle.battleActive = false;
		}
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

	const playerRow = await getPlayerById(playerId);
	if (!playerRow) throw serviceError(404, 'Player not found');
	const playerState = getPlayerState(playerRow);

	battle.battleActive = false;
	if (isRaidBossBattle(battle) && gameState.raidBoss) {
		gameState.raidBoss.currentHealth = Math.max(0, battle.monsterHealth);
		movePlayerToNearestTown(gameState, playerState);
		battle.battleLog.push(`${playerRow.name || 'Player'} escaped the castle and retreated to the nearest town.`);
	}
	battle.battleLog.push(`${playerRow.name || 'Player'} ran away! The battle is over.`);
	addRecentAction(gameState, 'battle-end', playerRow.name || 'Player', `ran away from ${battle.monster?.name || 'a monster'}`);

	const playerRows = await getPlayersByGameId(gameId);
	gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;

	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	await updateGameStateJson(gameId, JSON.stringify(gameState));
	return { success: true, battleLog: battle.battleLog, ranAway: true };
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
		await updateGameStateJson(gameId, JSON.stringify(gameState));
		return { success: true, reward: null };
	}

	const biome = battle.monster.biome.split(',')[0];
	const reward = getRandomItemForBiome(biome);
	if (reward) {
		if (reward.type === 'weapon' && !playerState.inventory.weapons.includes(reward.id)) {
			playerState.inventory.weapons.push(reward.id);
		} else if (reward.type === 'armor' && !playerState.inventory.armor.includes(reward.id)) {
			playerState.inventory.armor.push(reward.id);
		} else if (reward.type === 'item') {
			playerState.inventory.items.push(reward.id);
		}
	}

	gameState.recentlyFoundItem = { playerId, item: reward, ts: Date.now() };
	addRecentAction(gameState, 'battle-end', playerRow.name, `defeated ${battle.monster?.name || 'a monster'}`);

	const playerRows = await getPlayersByGameId(gameId);
	gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;

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
	if (isRaidBossBattle(battle) && gameState.raidBoss) {
		gameState.raidBoss.currentHealth = Math.max(0, battle.monsterHealth);
	}

	movePlayerToNearestTown(gameState, playerState);

	playerState.damage = 0;
	addRecentAction(gameState, 'battle-end', playerRow.name, 'returned to town after fainting');

	const playerRows = await getPlayersByGameId(gameId);
	gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;

	await updatePlayerStateById(playerId, JSON.stringify(playerState));
	await updateGameStateJson(gameId, JSON.stringify(gameState));

	return { success: true, returnedToTown: true };
}

export { attackBattle, runFromBattle, collectBattleLoot, returnPlayerToTown };
