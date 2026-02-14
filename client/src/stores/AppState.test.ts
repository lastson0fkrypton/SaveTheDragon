import { beforeEach, describe, expect, it } from 'vitest';
import AppState from './AppState';

class MockStorage implements Storage {
	private data = new Map<string, string>();

	get length() {
		return this.data.size;
	}

	clear(): void {
		this.data.clear();
	}

	getItem(key: string): string | null {
		return this.data.has(key) ? this.data.get(key)! : null;
	}

	key(index: number): string | null {
		return Array.from(this.data.keys())[index] ?? null;
	}

	removeItem(key: string): void {
		this.data.delete(key);
	}

	setItem(key: string, value: string): void {
		this.data.set(key, value);
	}
}

describe('AppState', () => {
	let storage: MockStorage;

	beforeEach(() => {
		storage = new MockStorage();
		Object.defineProperty(globalThis, 'localStorage', {
			value: storage,
			writable: true,
			configurable: true,
		});
	});

	it('loads initial values from localStorage', () => {
		storage.setItem('adminLoggedIn', 'true');
		storage.setItem('adminPassword', 'pw123');
		storage.setItem('gameId', 'g-123');
		storage.setItem('playerId', 'p-123');
		storage.setItem('playerName', 'Alice');

		const state = new AppState();

		expect(state.adminLoggedIn).toBe(true);
		expect(state.adminPassword).toBe('pw123');
		expect(state.gameId).toBe('g-123');
		expect(state.playerId).toBe('p-123');
		expect(state.playerName).toBe('Alice');
	});

	it('setAdminLoggedIn persists and removes storage values', () => {
		const state = new AppState();

		state.setAdminLoggedIn(true);
		expect(storage.getItem('adminLoggedIn')).toBe('true');

		state.setAdminLoggedIn(false);
		expect(storage.getItem('adminLoggedIn')).toBeNull();
	});

	it('setAdminPassword persists non-empty and removes empty values', () => {
		const state = new AppState();

		state.setAdminPassword('secret');
		expect(storage.getItem('adminPassword')).toBe('secret');

		state.setAdminPassword('');
		expect(storage.getItem('adminPassword')).toBeNull();
	});

	it('setPlayerId and setGameId persist ids', () => {
		const state = new AppState();

		state.setPlayerId('p-abc');
		state.setPlayerName('Bob');
		state.setGameId('g-abc');

		expect(state.playerId).toBe('p-abc');
		expect(state.playerName).toBe('Bob');
		expect(state.gameId).toBe('g-abc');
		expect(storage.getItem('playerId')).toBe('p-abc');
		expect(storage.getItem('playerName')).toBe('Bob');
		expect(storage.getItem('gameId')).toBe('g-abc');
	});

	it('reset clears runtime state and storage keys', () => {
		const state = new AppState();
		state.setPlayerId('p-reset');
		state.setPlayerName('Carol');
		state.setGameId('g-reset');
		state.setGameState({} as any);

		state.reset();

		expect(state.playerId).toBe('');
		expect(state.playerName).toBe('');
		expect(state.gameId).toBe('');
		expect(state.gameState).toBeNull();
		expect(storage.getItem('playerId')).toBeNull();
		expect(storage.getItem('playerName')).toBeNull();
		expect(storage.getItem('gameId')).toBeNull();
	});
});
