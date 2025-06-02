import express from 'express';
import { db } from '../db.js';
import { addRecentAction } from '../utils/gameUtils.js';
import { BIOME_ENCOUNTER_RATES } from '../constants/biomes.js';
import { CHARACTERS } from '../constants/characters.js';
import { ITEM_DEFS } from '../constants/items.js';
import { MONSTER_DEFS } from '../constants/monsters.js';

const router = express.Router();

// --- Add your player-related endpoints here (character select, equip, use-item, etc.) ---

// Endpoint to list available characters
router.get('/characters', (req, res) => {
	res.json(CHARACTERS);
});

// Endpoint to update a player's character
router.post('/games/:gameId/player/:playerId/character', (req, res) => {
	const { gameId, playerId } = req.params;
	const { characterId } = req.body;
	db.get('SELECT * FROM players WHERE id = ? AND gameId = ?', [playerId, gameId], (err, playerRow) => {
		if (!playerRow) return res.status(404).json({ error: 'Player not found' });
		const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
		playerState.characterId = characterId;
		db.run(
			'UPDATE players SET playerStateJson = ? WHERE id = ? AND gameId = ?',
			[JSON.stringify(playerState), playerId, gameId],
			err2 => {
				if (err2) return res.status(500).json({ error: 'Failed to update character' });
				res.json({ success: true });
			}
		);
	});
});

// Equip weapon or armor
router.post('/games/:gameId/player/:playerId/equip', (req, res) => {
	const { gameId, playerId } = req.params;
	const { itemId } = req.body;
	db.get('SELECT * FROM players WHERE id = ? AND gameId = ?', [playerId, gameId], (err, playerRow) => {
		if (!playerRow) return res.status(404).json({ error: 'Player not found' });
		const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
		const item = ITEM_DEFS.find(i => i.id === itemId);
		if (!item) return res.status(400).json({ error: 'Invalid item' });
		if (item.type === 'weapon' && playerState.inventory.weapons.includes(itemId)) {
			playerState.inventory.equippedWeaponId = itemId;
			// Add notification
			db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
				if (gameRow) {
					const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
					addRecentAction(gameState, 'equip', playerRow.name, item.name);
					db.run(
						'UPDATE games SET gameStateJson = ? WHERE id = ?',
						[JSON.stringify(gameState), gameId],
						() => {
							db.run(
								'UPDATE players SET playerStateJson = ? WHERE id = ?',
								[JSON.stringify(playerState), playerId],
								err2 => {
									if (err2) return res.status(500).json({ error: 'Failed to equip item' });
									res.json({ success: true });
								}
							);
						}
					);
				}
			});
			return;
		} else if (item.type === 'armor' && playerState.inventory.armor.includes(itemId)) {
			playerState.inventory.equippedArmorId = itemId;
			// Add notification
			db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
				if (gameRow) {
					const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
					addRecentAction(gameState, 'equip', playerRow.name, item.name);
					db.run(
						'UPDATE games SET gameStateJson = ? WHERE id = ?',
						[JSON.stringify(gameState), gameId],
						() => {
							db.run(
								'UPDATE players SET playerStateJson = ? WHERE id = ?',
								[JSON.stringify(playerState), playerId],
								err2 => {
									if (err2) return res.status(500).json({ error: 'Failed to equip item' });
									res.json({ success: true });
								}
							);
						}
					);
				}
			});
			return;
		} else {
			return res.status(400).json({ error: 'Item not in inventory' });
		}
	});
});

// Use item (e.g., potion, teleport, extra heart)
router.post('/games/:gameId/player/:playerId/use-item', (req, res) => {
	const { gameId, playerId } = req.params;
	const { itemId } = req.body;
	db.get('SELECT * FROM players WHERE id = ? AND gameId = ?', [playerId, gameId], (err, playerRow) => {
		if (!playerRow) return res.status(404).json({ error: 'Player not found' });
		const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
		if (!playerState.inventory.items.includes(itemId))
			return res.status(400).json({ error: 'Item not in inventory' });
		const item = ITEM_DEFS.find(i => i.id === itemId);
		if (!item || item.type !== 'item') return res.status(400).json({ error: 'Invalid item' });
		// Apply item effect
		let used = false;
		if (item.heal) {
			playerState.damage = Math.max(0, (playerState.damage || 0) - item.heal);
			used = true;
		} else if (item.effect === 'full_heal') {
			playerState.damage = 0;
			used = true;
		} else if (item.effect === 'extra_heart') {
			playerState.maxHearts = Math.min((playerState.maxHearts || 5) + 1, 20);
			used = true;
		} else if (item.effect === 'teleport') {
			// Teleport to nearest town
			db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
				if (gameRow) {
					const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
					const biomeGrid = gameState.biomeGrid;
					if (biomeGrid) {
						let minDist = Infinity,
							tx = 0,
							ty = 0;
						for (let y = 0; y < biomeGrid.length; y++) {
							for (let x = 0; x < biomeGrid[0].length; x++) {
								if (biomeGrid[y][x] === 'town') {
									const dist =
										Math.abs(playerState.positionX - x) + Math.abs(playerState.positionY - y);
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
						used = true;
					}
					if (used) {
						// Remove item from inventory
						playerState.inventory.items = playerState.inventory.items.filter(i => i !== itemId);
						addRecentAction(gameState, 'use-item', playerRow.name, item.name);
						db.run(
							'UPDATE games SET gameStateJson = ? WHERE id = ?',
							[JSON.stringify(gameState), gameId],
							() => {
								db.run(
									'UPDATE players SET playerStateJson = ? WHERE id = ?',
									[JSON.stringify(playerState), playerId],
									err2 => {
										if (err2) return res.status(500).json({ error: 'Failed to use item' });
										res.json({ success: true });
									}
								);
							}
						);
					} else {
						res.status(400).json({ error: 'Item cannot be used' });
					}
				}
			});
			return;
		}
		if (used) {
			// Remove item from inventory
			playerState.inventory.items = playerState.inventory.items.filter(i => i !== itemId);
			db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
				if (gameRow) {
					const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
					addRecentAction(gameState, 'use-item', playerRow.name, item.name);
					db.run(
						'UPDATE games SET gameStateJson = ? WHERE id = ?',
						[JSON.stringify(gameState), gameId],
						() => {
							db.run(
								'UPDATE players SET playerStateJson = ? WHERE id = ?',
								[JSON.stringify(playerState), playerId],
								err2 => {
									if (err2) return res.status(500).json({ error: 'Failed to use item' });
									res.json({ success: true });
								}
							);
						}
					);
				}
			});
			return;
		} else {
			res.status(400).json({ error: 'Item cannot be used' });
		}
	});
});

export default router;
