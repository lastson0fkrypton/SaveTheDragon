import express from 'express';
import { db } from '../db.js';
import { addRecentAction, getRandomItemForBiome } from '../utils/gameUtils.js';
import { BIOME_ENCOUNTER_RATES } from '../constants/biomes.js';
import { CHARACTERS } from '../constants/characters.js';
import { ITEM_DEFS } from '../constants/items.js';
import { MONSTER_DEFS } from '../constants/monsters.js';
import lastPoll from '../lastPoll.js';

const router = express.Router();

// --- Add your battle-related endpoints here (attack, run, collect-loot, return-to-town) ---

// --- BATTLE ENDPOINTS ---
// Player attacks monster
router.post('/games/:gameId/battle/attack', (req, res) => {
	const { gameId } = req.params;
	const { playerId } = req.body;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
		const battle = gameState.currentBattle;
		if (!battle || !battle.battleActive) return res.status(400).json({ error: 'No active battle' });
		if (battle.playerId !== playerId) return res.status(403).json({ error: 'Not your battle' });
		db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
			if (!playerRow) return res.status(404).json({ error: 'Player not found' });
			const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
			// Player attack
			const weaponId = playerState.inventory.equippedWeaponId || 'fist';
			const weapon = ITEM_DEFS.find(i => i.id === weaponId) || ITEM_DEFS.find(i => i.id === 'fist');
			let log = battle.battleLog || [];
			let playerHit = Math.random() < (weapon.attackChance || 0.5);
			let monsterBlock = Math.random() < (battle.monster.defenseChance || 0);
			let playerDmg = 0;
			if (playerHit) {
				playerDmg = weapon.attack || 1;
				if (monsterBlock) {
					playerDmg = Math.max(0, playerDmg - (battle.monster.defense || 0));
					log.push(`Monster blocks! Damage reduced.`);
				}
				battle.monsterHealth -= playerDmg;
				log.push(
					`${playerRow.name} attacks with ${weapon.name}: ${playerHit ? 'Hit' : 'Miss'}${
						playerDmg > 0 ? ` for ${playerDmg} damage!` : ''
					}`
				);
			} else {
				log.push(`${playerRow.name} attacks with ${weapon.name}: Miss!`);
			}
			// Check if monster defeated
			if (battle.monsterHealth <= 0) {
				log.push(`Monster ${battle.monster.name} defeated!`);
				battle.battleActive = false;
				// Do NOT clear currentBattle or advance turn here
			} else {
				// Monster attacks back if alive
				const armorId = playerState.inventory.equippedArmorId;
				const armor = armorId ? ITEM_DEFS.find(i => i.id === armorId) : null;
				let monsterHit = Math.random() < (battle.monster.attackChance || 0.5);
				let playerBlock = armor ? Math.random() < (armor.defenseChance || 0) : false;
				let monsterDmg = 0;
				if (monsterHit) {
					monsterDmg = battle.monster.attack || 1;
					if (playerBlock) {
						monsterDmg = Math.max(0, monsterDmg - (armor?.defense || 0));
						log.push(`${playerRow.name} blocks! Damage reduced.`);
					}
					battle.playerHealth -= monsterDmg;
					log.push(
						`Monster attacks: ${monsterHit ? 'Hit' : 'Miss'}${
							monsterDmg > 0 ? ` for ${monsterDmg} damage!` : ''
						}`
					);
				} else {
					log.push(`Monster attacks: Miss!`);
				}
				// Update player damage
				const maxHearts = playerState.maxHearts || 5;
				playerState.damage = Math.max(0, maxHearts - battle.playerHealth);
				// Check if player fainted
				if (battle.playerHealth <= 0) {
					battle.playerHealth = 0;
					log.push(`${playerRow.name} fainted due to injuries.`);
					battle.battleActive = false;
					// Do NOT clear currentBattle or advance turn here
				}
			}
			// Save state and return
			battle.battleLog = log;
			gameState.currentBattle = battle;
			db.run(
				'UPDATE players SET playerStateJson = ? WHERE id = ?',
				[JSON.stringify(playerState), playerId],
				() => {
					db.run(
						'UPDATE games SET gameStateJson = ? WHERE id = ?',
						[JSON.stringify(gameState), gameId],
						() => {
							res.json({ success: true, battleLog: log, battleActive: battle.battleActive });
						}
					);
				}
			);
		});
	});
});

// Player runs away
router.post('/games/:gameId/battle/run', (req, res) => {
	const { gameId } = req.params;
	const { playerId } = req.body;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
		const battle = gameState.currentBattle;
		if (!battle || !battle.battleActive) return res.status(400).json({ error: 'No active battle' });
		if (battle.playerId !== playerId) return res.status(403).json({ error: 'Not your battle' });
		battle.battleActive = false;
		// Add notification for all players
		if (!gameState.recentActions) gameState.recentActions = [];

		db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
			if (!playerRow) return res.status(404).json({ error: 'Player not found' });
			battle.battleLog.push(`${playerRow.name || 'Player'} ran away! The battle is over.`);

			addRecentAction(
				gameState,
				'battle-end',
				playerRow.name || 'Player',
				`ran away from ${battle.monster?.name || 'a monster'}`
			);

			// Advance turn and clear battle
			db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
				gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
				//gameState.currentBattle = null;
				db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId], () => {
					res.json({ success: true, battleLog: battle.battleLog, ranAway: true });
				});
			});
		});
	});
});

// Player collects loot after winning
router.post('/games/:gameId/battle/collect-loot', (req, res) => {
	const { gameId } = req.params;
	const { playerId } = req.body;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
		const battle = gameState.currentBattle;
		// Only allow if player won (monsterHealth <= 0, playerHealth > 0, battleActive is false)
		if (
			!battle ||
			battle.playerId !== playerId ||
			battle.monsterHealth > 0 ||
			battle.playerHealth <= 0 ||
			battle.battleActive !== false
		) {
			return res.status(400).json({ error: 'Cannot collect loot unless you have won the battle.' });
		}
		db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
			if (!playerRow) return res.status(404).json({ error: 'Player not found' });
			const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
			// Reward item
			const biome = battle.monster.biome.split(',')[0];
			const reward = getRandomItemForBiome(biome);
			if (reward) {
				if (reward.type === 'weapon' && !playerState.inventory.weapons.includes(reward.id))
					playerState.inventory.weapons.push(reward.id);
				else if (reward.type === 'armor' && !playerState.inventory.armor.includes(reward.id))
					playerState.inventory.armor.push(reward.id);
				else if (reward.type === 'item') playerState.inventory.items.push(reward.id);
			}
			// Add to recentlyFoundItem for modal
			gameState.recentlyFoundItem = {
				playerId,
				item: reward,
				ts: Date.now(),
			};
			// Add notification for all players
			addRecentAction(gameState, 'battle-end', playerRow.name, `defeated ${battle.monster?.name || 'a monster'}`);
			// Advance turn and clear battle
			db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
				gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
				db.run(
					'UPDATE players SET playerStateJson = ? WHERE id = ?',
					[JSON.stringify(playerState), playerId],
					() => {
						db.run(
							'UPDATE games SET gameStateJson = ? WHERE id = ?',
							[JSON.stringify(gameState), gameId],
							() => {
								res.json({ success: true, reward });
							}
						);
					}
				);
			});
		});
	});
});

// Player returns to town after fainting (button for UI)
router.post('/games/:gameId/battle/return-to-town', (req, res) => {
	const { gameId } = req.params;
	const { playerId } = req.body;
	db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
		if (!playerRow) return res.status(404).json({ error: 'Player not found' });
		const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
		db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
			if (!gameRow) return res.status(404).json({ error: 'Game not found' });
			const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
			const battle = gameState.currentBattle;
			// Only allow if player lost (playerHealth <= 0, battleActive is false)
			if (!battle || battle.playerId !== playerId || battle.playerHealth > 0 || battle.battleActive !== false) {
				return res.status(400).json({ error: 'Cannot return to town unless you have lost the battle.' });
			}
			// Move player to nearest town
			const biomeGrid = gameState.biomeGrid;
			if (biomeGrid) {
				let minDist = Infinity,
					tx = 0,
					ty = 0;
				for (let y = 0; y < biomeGrid.length; y++) {
					for (let x = 0; x < biomeGrid[0].length; x++) {
						if (biomeGrid[y][x] === 'town') {
							const dist = Math.abs(playerState.positionX - x) + Math.abs(playerState.positionY - y);
							if (dist < minDist) {
								minDist = dist;
								tx = x;
								ty = y;
							}
						}
					}
				}
				playerState.positionX = tx;
				playerState.positionY = ty;
			}
			playerState.damage = 0;
			// Add notification for all players
			addRecentAction(gameState, 'battle-end', playerRow.name, 'returned to town after fainting');
			// Advance turn and clear battle
			db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
				gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
				db.run(
					'UPDATE players SET playerStateJson = ? WHERE id = ?',
					[JSON.stringify(playerState), playerId],
					() => {
						db.run(
							'UPDATE games SET gameStateJson = ? WHERE id = ?',
							[JSON.stringify(gameState), gameId],
							() => {
								res.json({ success: true, returnedToTown: true });
							}
						);
					}
				);
			});
		});
	});
});

export default router;
