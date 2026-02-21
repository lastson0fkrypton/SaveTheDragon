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
