import { getItemDefs, getItemDropRateProfile } from '../constants/items.js';
import type {
	BiomeGrid,
	GameRow,
	GameStateJson,
	PlayerRow,
	PlayerState,
	RecentAction,
	ValidMoveRow,
} from '../types.js';
import { random, randomChoice, randomInt } from './random.js';

type ItemDefFromConstants = ReturnType<typeof getItemDefs>[number];

// Helper: serialize a game from DB rows
function serializeGame(gameRow: GameRow, playerRows: PlayerRow[], validMoveRows: ValidMoveRow[]) {
	// Parse game state JSON
	const gameState = gameRow.gameStateJson ? (JSON.parse(gameRow.gameStateJson) as Partial<GameStateJson>) : {};
	// Parse player state JSONs
	const players = playerRows.map((p): { id: string; name: string } & Partial<PlayerState> => {
		const playerState = p.playerStateJson ? (JSON.parse(p.playerStateJson) as Partial<PlayerState>) : {};
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
	const itemDefs = getItemDefs();
	const itemMeta: Record<string, ItemDefFromConstants> = {};
	itemDefs.forEach(def => {
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
function addRecentAction(gameState: Partial<GameStateJson>, type: string, playerName: string, itemName = ''): void {
	if (!gameState.recentActions) gameState.recentActions = [];
	const action: RecentAction = {
		id: `${Date.now()}_${Math.floor(random() * 1_000_000).toString(36)}`,
		type, // 'use-item' or 'equip'
		playerName,
		itemName,
		ts: Date.now(),
	};
	gameState.recentActions.push(action);
	// Keep only the latest 10 actions
	if (gameState.recentActions.length > 10) gameState.recentActions = gameState.recentActions.slice(-10);
}

function getRandomItemForBiome(tilebiome: string): ItemDefFromConstants | null {
	const itemDefs = getItemDefs();
	const dropRates = getItemDropRateProfile();
	// Only give biome-appropriate items (or biome:any), and not 'fist'
	const pool = itemDefs.filter(
		i => (i.biome === 'any' || (i.biome && i.biome.indexOf(tilebiome) !== -1)) && !i.noRandom
	);
	if (pool.length === 0) {
		return null;
	}

	const weightedPool = pool.map(item => {
		let weight = dropRates.typeWeights[item.type] || 1;
		const isHealthItem =
			item.type === 'item' &&
			((typeof item.heal === 'number' && item.heal > 0) || item.effect === 'full_heal' || item.effect === 'extra_heart');
		if (isHealthItem) {
			weight *= dropRates.healthItemMultiplier || 1;
		}
		if (item.id === 'extra_heart') {
			weight *= dropRates.extraHeartMultiplier || 1;
		}
		if (typeof dropRates.itemWeightOverrides[item.id] === 'number') {
			weight *= dropRates.itemWeightOverrides[item.id];
		}
		return {
			item,
			weight: Math.max(0, weight),
		};
	});

	const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
	if (totalWeight <= 0) {
		return randomChoice(pool);
	}

	let roll = random() * totalWeight;
	for (const entry of weightedPool) {
		roll -= entry.weight;
		if (roll <= 0) {
			return entry.item;
		}
	}

	return weightedPool[weightedPool.length - 1].item;
}

// --- Biome grid generation ---
function generateBiomeGrid(width: number, height: number): BiomeGrid {
	// Start with all plains
	const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => 'plains')) as BiomeGrid;

	// Helper to place a patch of a biome
	function placePatch(biome: string, count: number, patchSize: number) {
		for (let i = 0; i < count; i++) {
			const cx = randomInt(width);
			const cy = randomInt(height);
			for (let dx = -patchSize; dx <= patchSize; dx++) {
				for (let dy = -patchSize; dy <= patchSize; dy++) {
					const x = cx + dx;
					const y = cy + dy;
					if (x >= 0 && x < width && y >= 0 && y < height && random() < 0.7) {
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
			x = randomInt(width);
			y = randomInt(height);
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
	const [castleX, castleY] = randomChoice(corners);
	grid[castleY][castleX] = 'castle';
	// Surround castle with an expanded volcano danger zone
	const castleDangerRadius = 2;
	for (let dx = -castleDangerRadius; dx <= castleDangerRadius; dx++) {
		for (let dy = -castleDangerRadius; dy <= castleDangerRadius; dy++) {
			if (dx === 0 && dy === 0) continue;
			if (dx * dx + dy * dy > castleDangerRadius * castleDangerRadius) continue;
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
	const townCenters: Array<{ x: number; y: number }> = [];
	while (townsToPlace > 0 && attempts < 1000) {
		let x = randomInt(width);
		let y = randomInt(height);
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
