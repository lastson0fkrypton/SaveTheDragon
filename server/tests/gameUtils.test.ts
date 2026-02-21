import { describe, expect, it } from 'vitest';
import { resetDeckDefinitionsConfig, setDeckDefinitionsConfig } from '../config/deckDefinitionsConfig.js';
import { addRecentAction, generateBiomeGrid, serializeGame } from '../utils/gameUtils.ts';

describe('gameUtils', () => {
	it('addRecentAction keeps only the latest 10 actions', () => {
		const gameState: any = { recentActions: [] };
		for (let i = 0; i < 12; i++) {
			addRecentAction(gameState, 'equip', `Player${i}`, `Item${i}`);
		}

		expect(gameState.recentActions).toHaveLength(10);
		expect(gameState.recentActions[0].playerName).toBe('Player2');
		expect(gameState.recentActions[9].playerName).toBe('Player11');
	});

	it('generateBiomeGrid places one castle, circular expanded volcano danger zone, and at least one town', () => {
		const grid = generateBiomeGrid(20, 20) as any;
		let castleCount = 0;
		let townCount = 0;
		let castleX = -1;
		let castleY = -1;
		let volcanoAtDistanceTwo = 0;
		for (let y = 0; y < grid.length; y++) {
			for (let x = 0; x < grid[0].length; x++) {
				if (grid[y][x] === 'castle') {
					castleCount++;
					castleX = x;
					castleY = y;
				}
				if (grid[y][x] === 'town') townCount++;
			}
		}

		expect(castleCount).toBe(1);
		expect(townCount).toBeGreaterThan(0);

		for (let y = 0; y < grid.length; y++) {
			for (let x = 0; x < grid[0].length; x++) {
				if (grid[y][x] !== 'volcano') continue;
				const dx = x - castleX;
				const dy = y - castleY;
				const distSq = dx * dx + dy * dy;
				expect(distSq).toBeLessThanOrEqual(4);
				if (distSq === 4) volcanoAtDistanceTwo++;
			}
		}

		expect(volcanoAtDistanceTwo).toBeGreaterThan(0);
	});

	it('serializeGame includes players, valid moves and item metadata', () => {
		setDeckDefinitionsConfig({
			'final-boss': {
				id: 'evil_princess',
				name: 'Evil Princess',
				biome: 'castle',
				health: 120,
				attack: 8,
				attackChance: 0.85,
				defense: 5,
				defenseChance: 0.65,
				img: 'evil_princess.png',
			},
			startingItems: {
				weapon: {
					id: 'fist',
					name: 'Fist',
					type: 'weapon',
					biome: 'any',
					attack: 1,
					attackChance: 0.5,
				},
				armor: '',
			},
			itemDefinitions: {
				fist: {
					id: 'fist',
					name: 'Fist',
					type: 'weapon',
					biome: 'any',
					attack: 1,
					attackChance: 0.5,
				},
			},
			decks: {
				forest_encounter: { deck: 'forest_encounter', cards: [], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				forest_loot: { deck: 'forest_loot', cards: [], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				desert_encounter: { deck: 'desert_encounter', cards: [], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				desert_loot: { deck: 'desert_loot', cards: [], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				volcano_encounter: { deck: 'volcano_encounter', cards: [], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				volcano_loot: { deck: 'volcano_loot', cards: [], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
			},
		});

		const gameRow: any = {
			id: 'g1',
			gameStateJson: JSON.stringify({
				gridSizeX: 10,
				gridSizeY: 10,
				recentlyFoundItem: { item: { id: 'fist' } },
			}),
		};
		const playerRows: any[] = [
			{
				id: 'p1',
				name: 'Alice',
				playerStateJson: JSON.stringify({
					positionX: 1,
					positionY: 2,
					inventory: {
						weapons: ['fist'],
						armor: [],
						items: [],
						equippedWeaponId: 'fist',
						equippedArmorId: null,
					},
				}),
			},
		];
		const validMoveRows = [
			{
				gameId: 'g1',
				x: 2,
				y: 3,
			},
		];

		const result: any = serializeGame(gameRow, playerRows, validMoveRows);

		expect(result.players).toHaveLength(1);
		expect(result.validMoves).toEqual([{ x: 2, y: 3 }]);
		expect(result.itemMeta.fist).toBeDefined();

		resetDeckDefinitionsConfig();
	});
});
