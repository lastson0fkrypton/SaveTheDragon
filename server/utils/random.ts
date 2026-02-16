import { AsyncLocalStorage } from 'node:async_hooks';

type RandomProvider = () => number;

const randomContext = new AsyncLocalStorage<RandomProvider>();

function hashSeed(seed: string | number): number {
	const seedText = String(seed);
	let hash = 2166136261;
	for (let index = 0; index < seedText.length; index += 1) {
		hash ^= seedText.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

export function createSeededRandom(seed: string | number): RandomProvider {
	let state = hashSeed(seed);
	if (state === 0) {
		state = 0x6d2b79f5;
	}

	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

export function withRandomProvider<T>(provider: RandomProvider, work: () => Promise<T> | T): Promise<T> | T {
	return randomContext.run(provider, work);
}

export function random(): number {
	const provider = randomContext.getStore();
	return provider ? provider() : Math.random();
}

export function randomInt(maxExclusive: number): number {
	if (maxExclusive <= 0) {
		return 0;
	}
	return Math.floor(random() * maxExclusive);
}

export function randomChoice<T>(items: readonly T[]): T {
	if (items.length === 0) {
		throw new Error('Cannot choose from an empty array');
	}
	return items[randomInt(items.length)];
}

export function randomId(length = 9): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let index = 0; index < length; index += 1) {
		id += alphabet[randomInt(alphabet.length)];
	}
	return id;
}