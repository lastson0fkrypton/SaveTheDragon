import { describe, expect, it } from 'vitest';
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

	it('generateBiomeGrid places one castle and at least one town', () => {
		const grid = generateBiomeGrid(20, 20) as any;
		let castleCount = 0;
		let townCount = 0;
		for (let y = 0; y < grid.length; y++) {
			for (let x = 0; x < grid[0].length; x++) {
				if (grid[y][x] === 'castle') castleCount++;
				if (grid[y][x] === 'town') townCount++;
			}
		}

		expect(castleCount).toBe(1);
		expect(townCount).toBeGreaterThan(0);
	});

	it('serializeGame includes players, valid moves and item metadata', () => {
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
	});
});
