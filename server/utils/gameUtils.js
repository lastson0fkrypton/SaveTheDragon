import { ITEM_DEFS } from '../constants/items.js';

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

export { serializeGame, addRecentAction, getRandomItemForBiome, generateBiomeGrid };
