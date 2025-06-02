import express from 'express';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import path from 'path';

//import from the constants
import { ITEM_DEFS } from './constants/items.js';
import { CHARACTERS } from './constants/characters.js';
import { MONSTER_DEFS } from './constants/monsters.js';
import { BIOME_ENCOUNTER_RATES } from './constants/biomes.js';

const app = express();
const PORT = 3000;

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
	db.run(`CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    gameStateJson TEXT
  )`);
	db.run(`CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    gameId TEXT,
    name TEXT,
    playerStateJson TEXT,
    FOREIGN KEY(gameId) REFERENCES games(id)
  )`);
	db.run(`CREATE TABLE IF NOT EXISTS valid_moves (
    gameId TEXT,
    x INTEGER,
    y INTEGER,
    FOREIGN KEY(gameId) REFERENCES games(id)
  )`);
});

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the dist folder
app.use(express.static('dist'));

// Track last poll time for each game
const lastPoll = {};
// --- SQLite-based game state persistence ---

// Helper: serialize a game from DB rows
function serializeGame(gameRow, playerRows, validMoveRows) {
	// Parse game state JSON
	const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
	// Parse player state JSONs
	const players = playerRows.map(p => {
		const playerState = p.playerStateJson ? JSON.parse(p.playerStateJson) : {};
		return {
			id: p.id,
			name: p.name,
			...playerState,
		};
	});
	// Attach item metadata for all items in play
	const allItemIds = new Set();
	players.forEach(p => {
		if (p.inventory) {
			(p.inventory.weapons || []).forEach(id => allItemIds.add(id));
			(p.inventory.armor || []).forEach(id => allItemIds.add(id));
			(p.inventory.items || []).forEach(id => allItemIds.add(id));
			if (p.inventory.equippedWeaponId) allItemIds.add(p.inventory.equippedWeaponId);
			if (p.inventory.equippedArmorId) allItemIds.add(p.inventory.equippedArmorId);
		}
	});
	if (gameState.recentlyFoundItem && gameState.recentlyFoundItem.item?.id) {
		allItemIds.add(gameState.recentlyFoundItem.item.id);
	}
	const itemMeta = {};
	ITEM_DEFS.forEach(def => {
		if (allItemIds.has(def.id)) itemMeta[def.id] = def;
	});
	return {
		id: gameRow.id,
		...gameState,
		players,
		validMoves: validMoveRows.map(m => ({ x: m.x, y: m.y })),
		gridSizeX: gameState.gridSizeX || 10,
		gridSizeY: gameState.gridSizeY || 10,
		itemMeta,
	};
}

// Helper to add a recent action to the game state
function addRecentAction(gameState, type, playerName, itemName) {
	if (!gameState.recentActions) gameState.recentActions = [];
	const action = {
		id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		type, // 'use-item' or 'equip'
		playerName,
		itemName,
		ts: Date.now(),
	};
	gameState.recentActions.push(action);
	// Keep only the latest 10 actions
	if (gameState.recentActions.length > 10) gameState.recentActions = gameState.recentActions.slice(-10);
}

function getRandomItemForBiome(tilebiome) {
	// Only give biome-appropriate items (or biome:any), and not 'fist'
	const pool = ITEM_DEFS.filter(
		i => (i.biome === 'any' || (i.biome && i.biome.indexOf(tilebiome) !== -1)) && !i.noRandom
	);
	return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
}

// --- Biome grid generation ---
function generateBiomeGrid(width, height) {
	// Start with all plains
	const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => 'plains'));

	// Helper to place a patch of a biome
	function placePatch(biome, count, patchSize) {
		for (let i = 0; i < count; i++) {
			const cx = Math.floor(Math.random() * width);
			const cy = Math.floor(Math.random() * height);
			for (let dx = -patchSize; dx <= patchSize; dx++) {
				for (let dy = -patchSize; dy <= patchSize; dy++) {
					const x = cx + dx;
					const y = cy + dy;
					if (x >= 0 && x < width && y >= 0 && y < height && Math.random() < 0.7) {
						grid[y][x] = biome;
					}
				}
			}
		}
	}

	// Place forest and desert patches
	placePatch('forest', Math.floor((width * height) / 30), 2);
	placePatch('desert', Math.floor((width * height) / 30), 2);

	// Place caves (single cells)
	for (let i = 0; i < Math.max(1, Math.floor((width * height) / 100)); i++) {
		let x, y;
		do {
			x = Math.floor(Math.random() * width);
			y = Math.floor(Math.random() * height);
		} while (grid[y][x] !== 'plains');
		grid[y][x] = 'cave';
	}

	// Place castle in a random corner and surround with volcanoes
	const corners = [
		[0, 0],
		[0, height - 1],
		[width - 1, 0],
		[width - 1, height - 1],
	];
	const [castleX, castleY] = corners[Math.floor(Math.random() * corners.length)];
	grid[castleY][castleX] = 'castle';
	// Surround castle with volcanoes
	for (let dx = -1; dx <= 1; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			if (dx === 0 && dy === 0) continue;
			const x = castleX + dx;
			const y = castleY + dy;
			if (x >= 0 && x < width && y >= 0 && y < height) {
				grid[y][x] = 'volcano';
			}
		}
	}

	// Place towns (single cells) at least 6 spaces from the castle
	let townsToPlace = Math.max(2, Math.floor((width * height) / 80));
	let attempts = 0;
	const townCenters = [];
	while (townsToPlace > 0 && attempts < 1000) {
		let x = Math.floor(Math.random() * width);
		let y = Math.floor(Math.random() * height);
		// Manhattan distance from castle
		const dist = Math.abs(x - castleX) + Math.abs(y - castleY);
		if (grid[y][x] === 'plains' && dist >= 6) {
			grid[y][x] = 'town';
			townCenters.push({ x, y });
			// Surround town with plains (unless castle or volcano)
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					if (dx === 0 && dy === 0) continue;
					const nx = x + dx;
					const ny = y + dy;
					if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
						grid[ny][nx] = 'plains';
					}
				}
			}
			townsToPlace--;
		}
		attempts++;
	}
	// Attach townCenters to grid for player spawn logic
	grid._townCenters = townCenters;

	return grid;
}

// Create a new game
app.post('/api/games', (req, res) => {
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
app.post('/api/games/:gameId/join', (req, res) => {
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
app.get('/api/games/:gameId', (req, res) => {
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
app.post('/api/games/:gameId/roll', (req, res) => {
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
app.post('/api/games/:gameId/move', (req, res) => {
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
								`Player: ${playerRows.find(p => p.id === playerId)?.name || 'Player'} vs ${
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

// --- BATTLE ENDPOINTS ---
// Player attacks monster
app.post('/api/games/:gameId/battle/attack', (req, res) => {
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
					`Player attacks with ${weapon.name}: ${playerHit ? 'Hit' : 'Miss'}${
						playerDmg > 0 ? ` for ${playerDmg} damage!` : ''
					}`
				);
			} else {
				log.push(`Player attacks with ${weapon.name}: Miss!`);
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
						log.push(`Player blocks! Damage reduced.`);
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
					log.push(`Player fainted due to injuries.`);
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
app.post('/api/games/:gameId/battle/run', (req, res) => {
	const { gameId } = req.params;
	const { playerId } = req.body;
	db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
		if (!gameRow) return res.status(404).json({ error: 'Game not found' });
		const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
		const battle = gameState.currentBattle;
		if (!battle || !battle.battleActive) return res.status(400).json({ error: 'No active battle' });
		if (battle.playerId !== playerId) return res.status(403).json({ error: 'Not your battle' });
		battle.battleActive = false;
		battle.battleLog.push('Player ran away! The battle is over.');
		// Add notification for all players
		if (!gameState.recentActions) gameState.recentActions = [];

		db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
			if (!playerRow) return res.status(404).json({ error: 'Player not found' });
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
app.post('/api/games/:gameId/battle/collect-loot', (req, res) => {
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
			gameState.currentBattle = null;
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
app.post('/api/games/:gameId/battle/return-to-town', (req, res) => {
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
			//gameState.currentBattle = null;
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

// Fetch the latest game state
app.get('/api/games/:gameId/state', (req, res) => {
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
app.post('/api/games/:gameId/reconnect', (req, res) => {
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

// Admin endpoint to list all games (requires password)
app.get('/api/admin/games', (req, res) => {
	const password = req.query.password;
	if (password !== 'superman') {
		return res.status(403).json({ error: 'Forbidden' });
	}
	db.all('SELECT * FROM games', (err, gameRows) => {
		db.all('SELECT * FROM players', (err, playerRows) => {
			const allGames = gameRows.map(gameRow => ({
				gameId: gameRow.id,
				players: playerRows.filter(p => p.gameId === gameRow.id).map(p => ({ id: p.id, name: p.name })),
				currentTurn: playerRows.filter(p => p.gameId === gameRow.id)[gameRow.currentTurn]?.name || null,
				currentDiceRoll: gameRow.currentDiceRoll || null,
			}));
			res.json(allGames);
		});
	});
});

// Admin endpoint to delete a game (requires password)
app.delete('/api/admin/games/:gameId', (req, res) => {
	const password = req.query.password;
	if (password !== 'superman') {
		return res.status(403).json({ error: 'Forbidden' });
	}
	const { gameId } = req.params;
	db.run('DELETE FROM games WHERE id = ?', [gameId], err => {
		db.run('DELETE FROM players WHERE gameId = ?', [gameId]);
		db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
		res.json({ success: true });
	});
});

// Endpoint to list available characters
app.get('/api/characters', (req, res) => {
	res.json(CHARACTERS);
});

// Endpoint to update a player's character
app.post('/api/games/:gameId/player/:playerId/character', (req, res) => {
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
app.post('/api/games/:gameId/player/:playerId/equip', (req, res) => {
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
app.post('/api/games/:gameId/player/:playerId/use-item', (req, res) => {
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

// Periodically clean up inactive games (no poll in 60s)
setInterval(() => {
	const now = Date.now();
	db.all('SELECT id FROM games', (err, rows) => {
		if (rows) {
			for (const row of rows) {
				const gameId = row.id;
				if (!lastPoll[gameId] || now - lastPoll[gameId] > 60000) {
					db.run('DELETE FROM games WHERE id = ?', [gameId]);
					db.run('DELETE FROM players WHERE gameId = ?', [gameId]);
					db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
					delete lastPoll[gameId];
					console.log(`Game ${gameId} deleted due to inactivity.`);
				}
			}
		}
	});
}, 60000);

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
