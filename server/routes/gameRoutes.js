import express from 'express';
import { db } from '../db.js';
import { serializeGame, addRecentAction, generateBiomeGrid, getRandomItemForBiome } from '../utils/gameUtils.js';
import { BIOME_ENCOUNTER_RATES } from '../constants/biomes.js';
import { CHARACTERS } from '../constants/characters.js';
import { ITEM_DEFS } from '../constants/items.js';
import { MONSTER_DEFS } from '../constants/monsters.js';
import lastPoll from '../lastPoll.js';

const router = express.Router();

// --- Game creation ---
router.post('/games', (req, res) => {
	const { gridSizeX, gridSizeY } = req.body;
	const safeX = Math.max(10, Math.min(100, parseInt(gridSizeX) || 10));
	const safeY = Math.max(10, Math.min(100, parseInt(gridSizeY) || 10));
	const gameId = Math.random().toString(36).substr(2, 9);
	const biomeGrid = generateBiomeGrid(safeX, safeY);
	db.run(
		'INSERT INTO games (id, gameStateJson) VALUES (?, ?)',
		[
			gameId,
			JSON.stringify({ currentTurn: 0, currentDiceRoll: null, gridSizeX: safeX, gridSizeY: safeY, biomeGrid }),
		],
		err => {
			if (err) return res.status(500).json({ error: 'DB error' });
			res.status(201).json({ gameId });
		}
	);
});

// Join an existing game
router.post('/games/:gameId/join', (req, res) => {
	const { gameId } = req.params;
	const { playerName } = req.body;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (err) {
			console.error('DB error (games lookup):', err);
			return res.status(500).json({ error: 'DB error' });
		}
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });

		db.all('SELECT playerStateJson FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
			if (err) {
				console.error('DB error (players lookup):', err);
				return res.status(500).json({ error: 'DB error' });
			}
			// Remove already used pics
			const usedCharacters = playerRows.map(p => JSON.parse(p.playerStateJson).characterId);
			const usedPositions = playerRows
				.map(p => {
					const ps = JSON.parse(p.playerStateJson);
					return ps && typeof ps.positionX === 'number' && typeof ps.positionY === 'number'
						? `${ps.positionX},${ps.positionY}`
						: null;
				})
				.filter(Boolean);
			const availableCharacters = CHARACTERS.filter(character => !usedCharacters.includes(character.id));
			// Pick a random available pic, or fallback to 'default.png'
			const randomCharacterId =
				availableCharacters.length > 0
					? availableCharacters[Math.floor(Math.random() * availableCharacters.length)].id
					: 'none';
			db.get('SELECT * FROM players WHERE gameId = ? AND name = ?', [gameId, playerName], (err, playerRow) => {
				if (err) {
					console.error('DB error (players lookup):', err);
					return res.status(500).json({ error: 'DB error' });
				}
				if (playerRow) {
					return res.status(200).json({ playerId: playerRow.id });
				}
				const playerId = Math.random().toString(36).substr(2, 9);
				// --- Assign random position around a town not occupied by other players ---
				const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
				const gridSizeX = gameState.gridSizeX || 10;
				const gridSizeY = gameState.gridSizeY || 10;
				const biomeGrid = gameState.biomeGrid;
				let possiblePositions = [];
				let townCenters = biomeGrid && biomeGrid._townCenters ? biomeGrid._townCenters : null;
				if (!townCenters) {
					// fallback: find all towns
					townCenters = [];
					for (let y = 0; y < gridSizeY; y++) {
						for (let x = 0; x < gridSizeX; x++) {
							if (biomeGrid[y][x] === 'town') townCenters.push({ x, y });
						}
					}
				}
				// Find all plains cells adjacent to a town
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
				// fallback: any plains
				if (possiblePositions.length === 0) {
					for (let x = 0; x < gridSizeX; x++) {
						for (let y = 0; y < gridSizeY; y++) {
							if (biomeGrid[y][x] === 'plains' && !usedPositions.includes(`${x},${y}`)) {
								possiblePositions.push({ x, y });
							}
						}
					}
				}
				let positionX = 0,
					positionY = 0;
				if (possiblePositions.length > 0) {
					const pos = possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
					positionX = pos.x;
					positionY = pos.y;
				}
				const playerState = {
					positionX,
					positionY,
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
				db.run(
					'INSERT INTO players (id, gameId, name, playerStateJson) VALUES (?, ?, ?, ?)',
					[playerId, gameId, playerName, JSON.stringify(playerState)],
					err2 => {
						if (err2) {
							console.error('DB error (insert player):', err2);
							return res.status(500).json({ error: 'DB error' });
						}
						res.status(200).json({ playerId });
					}
				);
			});
		});
	});
});

// Fetch game state
router.get('/games/:gameId', (req, res) => {
	const { gameId } = req.params;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
			db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
				res.json(serializeGame(gameRow, playerRows, validMoveRows));
			});
		});
	});
});

// Roll dice and return the number of spaces the player can move, plus valid moves
router.post('/games/:gameId/roll', (req, res) => {
	const { gameId } = req.params;
	const { playerId } = req.body;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
		const gridSizeX = gameState.gridSizeX || 10;
		const gridSizeY = gameState.gridSizeY || 10;
		db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
			const player = playerRows.find(p => p.id === playerId);
			if (!player) return res.status(404).json({ error: 'Player not found' });
			if (playerRows[gameState.currentTurn].id !== playerId)
				return res.status(400).json({ error: 'Not your turn' });
			if (gameState.currentDiceRoll) return res.status(400).json({ error: 'Dice already rolled for this turn' });
			const diceRoll = Math.floor(Math.random() * 6) + 1;
			// Compute valid moves
			const playerState = player.playerStateJson ? JSON.parse(player.playerStateJson) : {};
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
								if (p.id === player.id) return false;
								const ps = p.playerStateJson ? JSON.parse(p.playerStateJson) : {};
								return ps.positionX === x && ps.positionY === y;
							})
						) {
							moves.push({ x, y });
						}
					}
				}
			}
			gameState.currentDiceRoll = diceRoll;
			db.serialize(() => {
				db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
				db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
				const stmt = db.prepare('INSERT INTO valid_moves (gameId, x, y) VALUES (?, ?, ?)');
				for (const m of moves) stmt.run(gameId, m.x, m.y);
				stmt.finalize(() => {
					res.json({ diceRoll, validMoves: moves });
				});
			});
		});
	});
});

// Validate and process the player's move
router.post('/games/:gameId/move', (req, res) => {
	const { gameId } = req.params;
	const { playerId, targetX, targetY } = req.body;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
		const gridSizeX = gameState.gridSizeX || 10;
		const gridSizeY = gameState.gridSizeY || 10;
		db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
			const player = playerRows.find(p => p.id === playerId);
			if (!player) return res.status(404).json({ error: 'Player not found' });
			if (playerRows[gameState.currentTurn].id !== playerId)
				return res.status(400).json({ error: 'Not your turn' });
			db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
				const isValid = validMoveRows.some(m => m.x === targetX && m.y === targetY);
				if (!isValid) return res.status(400).json({ error: 'Invalid move' });
				// Move player, clear dice/valid_moves
				// --- Only advance turn if no battle is encountered ---
				let advanceTurn = true;
				// Update player state
				const playerState = player.playerStateJson ? JSON.parse(player.playerStateJson) : {};
				playerState.positionX = targetX;
				playerState.positionY = targetY;
				// --- Reduce health by 1 if moving onto cave biome ---
				const biome = gameState.biomeGrid?.[targetY]?.[targetX] || 'plains';
				if (biome === 'town') {
					playerState.damage = 0;
					addRecentAction(gameState, 'visit-town', player.name || 'Player');
				}
				// --- Remove gifting item on every move ---
				gameState.recentlyFoundItem = null;
				gameState.currentBattle = null;

				// --- Monster encounter logic ---
				let encounter = false;
				let encounteredMonster = null;

				// not sure how we get here, unless the battle is swapped from one player to another
				if (BIOME_ENCOUNTER_RATES[biome] > 0 && Math.random() < BIOME_ENCOUNTER_RATES[biome]) {
					// Find monsters for this biome
					const biomeMonsters = MONSTER_DEFS.filter(m => m.biome.split(',').includes(biome));
					if (biomeMonsters.length > 0) {
						encounter = true;
						encounteredMonster = biomeMonsters[Math.floor(Math.random() * biomeMonsters.length)];
						// Set battle state in gameState
						gameState.currentBattle = {
							playerId,
							monster: encounteredMonster,
							playerHealth: (playerState.maxHearts || 5) - (playerState.damage || 0),
							monsterHealth: encounteredMonster.health, // Monster health
							battleLog: [
								`A wild ${encounteredMonster.name} appeared!`,
								`${playerRows.find(p => p.id === playerId)?.name || 'Player'} vs ${
									encounteredMonster.name
								}`,
							],
							battleActive: true,
							biome: biome,
							ts: Date.now(),
						};
						advanceTurn = false;
					}
				} else {
					gameState.currentBattle = null;
				}

				// Only advance turn if no battle was started
				if (advanceTurn) {
					gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
				}
				gameState.currentDiceRoll = null;
				db.serialize(() => {
					db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [
						JSON.stringify(playerState),
						playerId,
					]);
					db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
					db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
					// Return new state
					db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, newGameRow) => {
						db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, newPlayerRows) => {
							db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, newValidMoveRows) => {
								res.json({
									success: true,
									gameState: serializeGame(newGameRow, newPlayerRows, newValidMoveRows),
								});
							});
						});
					});
				});
			});
		});
	});
});

// Fetch the latest game state
router.get('/games/:gameId/state', (req, res) => {
	const { gameId } = req.params;
	lastPoll[gameId] = Date.now();
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
			db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
				res.json(serializeGame(gameRow, playerRows, validMoveRows));
			});
		});
	});
});

// Reconnect a player to a game
router.post('/games/:gameId/reconnect', (req, res) => {
	const { gameId } = req.params;
	const { playerName } = req.body;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		db.get('SELECT * FROM players WHERE gameId = ? AND name = ?', [gameId, playerName], (err, playerRow) => {
			if (!playerRow) return res.status(404).json({ error: 'Player not found' });
			db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
				db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
					res.json({ playerId: playerRow.id, gameState: serializeGame(gameRow, playerRows, validMoveRows) });
				});
			});
		});
	});
});

export default router;
