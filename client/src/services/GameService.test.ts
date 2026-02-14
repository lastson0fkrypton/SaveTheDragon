import { beforeEach, describe, expect, it, vi } from 'vitest';
import GameService from './GameService';

type MockStore = {
	setAdminError: ReturnType<typeof vi.fn>;
	setAdminLoggedIn: ReturnType<typeof vi.fn>;
	setAdminPassword: ReturnType<typeof vi.fn>;
	setAdminGames: ReturnType<typeof vi.fn>;
	setPlayerId: ReturnType<typeof vi.fn>;
	setGameId: ReturnType<typeof vi.fn>;
	gameId: string;
	playerId: string;
};

function createStore(overrides: Partial<MockStore> = {}): MockStore {
	return {
		setAdminError: vi.fn(),
		setAdminLoggedIn: vi.fn(),
		setAdminPassword: vi.fn(),
		setAdminGames: vi.fn(),
		setPlayerId: vi.fn(),
		setGameId: vi.fn(),
		gameId: 'game-1',
		playerId: 'player-1',
		...overrides,
	};
}

function mockResponse(ok: boolean, jsonValue: unknown = {}) {
	return {
		ok,
		json: vi.fn().mockResolvedValue(jsonValue),
	} as unknown as Response;
}

describe('GameService', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('fetchAdminGames stores admin state on success', async () => {
		const store = createStore();
		const service = new GameService(store as any);
		const games = [{ gameId: 'a' }];
		vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, games));

		await service.fetchAdminGames('pw');

		expect(fetch).toHaveBeenCalledWith('/api/admin/games?password=pw');
		expect(store.setAdminError).toHaveBeenCalledWith('');
		expect(store.setAdminLoggedIn).toHaveBeenCalledWith(true);
		expect(store.setAdminPassword).toHaveBeenCalledWith('pw');
		expect(store.setAdminGames).toHaveBeenCalledWith(games);
	});

	it('fetchAdminGames sets error on forbidden', async () => {
		const store = createStore();
		const service = new GameService(store as any);
		vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));

		await service.fetchAdminGames('bad');

		expect(store.setAdminError).toHaveBeenCalledWith('Incorrect password or forbidden');
		expect(store.setAdminLoggedIn).not.toHaveBeenCalled();
	});

	it('createGame creates then joins and stores ids', async () => {
		const store = createStore();
		const service = new GameService(store as any);
		vi.mocked(fetch)
			.mockResolvedValueOnce(mockResponse(true, { gameId: 'g-100' }))
			.mockResolvedValueOnce(mockResponse(true, { playerId: 'p-200' }));

		await service.createGame('Alice', 10, 12);

		expect(fetch).toHaveBeenNthCalledWith(
			1,
			'/api/games',
			expect.objectContaining({ method: 'POST' })
		);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			'/api/games/g-100/join',
			expect.objectContaining({ method: 'POST' })
		);
		expect(store.setPlayerId).toHaveBeenCalledWith('p-200');
		expect(store.setGameId).toHaveBeenCalledWith('g-100');
	});

	it('joinGame sets player and game ids', async () => {
		const store = createStore();
		const service = new GameService(store as any);
		vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, { playerId: 'p-join' }));

		await service.joinGame('g-join', 'Bob');

		expect(fetch).toHaveBeenCalledWith(
			'/api/games/g-join/join',
			expect.objectContaining({ method: 'POST' })
		);
		expect(store.setPlayerId).toHaveBeenCalledWith('p-join');
		expect(store.setGameId).toHaveBeenCalledWith('g-join');
	});

	it('fetchGameState returns null on non-ok response', async () => {
		const store = createStore();
		const service = new GameService(store as any);
		vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));

		const result = await service.fetchGameState('g-state');

		expect(result).toBeNull();
	});

	it('rollDice does nothing when ids are missing', async () => {
		const store = createStore({ gameId: '', playerId: '' });
		const service = new GameService(store as any);

		await service.rollDice();

		expect(fetch).not.toHaveBeenCalled();
	});

	it('rollDice posts to roll endpoint when ids are present', async () => {
		const store = createStore({ gameId: 'g-1', playerId: 'p-1' });
		const service = new GameService(store as any);
		vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true));

		await service.rollDice();

		expect(fetch).toHaveBeenCalledWith(
			'/api/games/g-1/roll',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('movePlayer posts coordinates and player id', async () => {
		const store = createStore({ gameId: 'g-2', playerId: 'p-2' });
		const service = new GameService(store as any);
		vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true));

		await service.movePlayer(3, 4);

		expect(fetch).toHaveBeenCalledWith(
			'/api/games/g-2/move',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ playerId: 'p-2', targetX: 3, targetY: 4 }),
			})
		);
	});

	it('battle helpers call their respective endpoints', async () => {
		const store = createStore({ gameId: 'g-b', playerId: 'p-b' });
		const service = new GameService(store as any);
		vi.mocked(fetch)
			.mockResolvedValueOnce(mockResponse(true))
			.mockResolvedValueOnce(mockResponse(true))
			.mockResolvedValueOnce(mockResponse(true))
			.mockResolvedValueOnce(mockResponse(true));

		await service.attack();
		await service.run();
		await service.collectLoot();
		await service.returnToTown();

		expect(fetch).toHaveBeenNthCalledWith(
			1,
			'/api/games/g-b/battle/attack',
			expect.objectContaining({ method: 'POST' })
		);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			'/api/games/g-b/battle/run',
			expect.objectContaining({ method: 'POST' })
		);
		expect(fetch).toHaveBeenNthCalledWith(
			3,
			'/api/games/g-b/battle/collect-loot',
			expect.objectContaining({ method: 'POST' })
		);
		expect(fetch).toHaveBeenNthCalledWith(
			4,
			'/api/games/g-b/battle/return-to-town',
			expect.objectContaining({ method: 'POST' })
		);
	});
});
