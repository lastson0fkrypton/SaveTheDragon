import fs from 'node:fs';
import path from 'node:path';

export type PlayBiome = 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';
export type MonsterVariant = 'weak' | 'normal' | 'strong';
export type EncounterCardKind = 'monster' | 'item' | 'consumable' | 'heart';
export type LootCardKind = 'item' | 'consumable' | 'heart';

export type BiomeDeckTemplate = {
	encounterComposition: Record<EncounterCardKind, number>;
	lootComposition: Record<LootCardKind, number>;
	monsterVariantWeights: Record<MonsterVariant, number>;
};

export type BiomeDeckConfig = {
	BIOME_DECKS: Record<PlayBiome, BiomeDeckTemplate>;
};

export const DEFAULT_BIOME_DECK_CONFIG: BiomeDeckConfig = {
	BIOME_DECKS: {
		plains: {
			encounterComposition: { monster: 9, item: 5, consumable: 4, heart: 2 },
			lootComposition: { item: 7, consumable: 4, heart: 1 },
			monsterVariantWeights: { weak: 0.6, normal: 0.35, strong: 0.05 },
		},
		forest: {
			encounterComposition: { monster: 10, item: 5, consumable: 3, heart: 2 },
			lootComposition: { item: 7, consumable: 4, heart: 1 },
			monsterVariantWeights: { weak: 0.4, normal: 0.45, strong: 0.15 },
		},
		desert: {
			encounterComposition: { monster: 12, item: 4, consumable: 3, heart: 1 },
			lootComposition: { item: 8, consumable: 3, heart: 1 },
			monsterVariantWeights: { weak: 0.2, normal: 0.55, strong: 0.25 },
		},
		cave: {
			encounterComposition: { monster: 13, item: 3, consumable: 3, heart: 1 },
			lootComposition: { item: 8, consumable: 3, heart: 1 },
			monsterVariantWeights: { weak: 0.1, normal: 0.5, strong: 0.4 },
		},
		volcano: {
			encounterComposition: { monster: 14, item: 3, consumable: 2, heart: 1 },
			lootComposition: { item: 9, consumable: 2, heart: 1 },
			monsterVariantWeights: { weak: 0.05, normal: 0.45, strong: 0.5 },
		},
	},
};

let activeBiomeDeckConfig: BiomeDeckConfig = structuredClone(DEFAULT_BIOME_DECK_CONFIG);

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeKnownKeys<T extends Record<string, unknown>>(base: T, maybeOverride: unknown): T {
	if (!isPlainObject(maybeOverride)) {
		return structuredClone(base);
	}

	const next = structuredClone(base);
	const mutableNext = next as Record<string, unknown>;
	for (const key of Object.keys(base)) {
		const overrideValue = maybeOverride[key];
		if (overrideValue === undefined) continue;
		if (isPlainObject(base[key]) && isPlainObject(overrideValue)) {
			mutableNext[key] = mergeKnownKeys(base[key] as Record<string, unknown>, overrideValue);
		} else {
			mutableNext[key] = overrideValue as T[keyof T];
		}
	}

	return next;
}

function normalize(config: unknown): BiomeDeckConfig {
	const merged = mergeKnownKeys(DEFAULT_BIOME_DECK_CONFIG as Record<string, unknown>, config) as BiomeDeckConfig;
	for (const biome of Object.keys(merged.BIOME_DECKS) as PlayBiome[]) {
		const weights = merged.BIOME_DECKS[biome].monsterVariantWeights;
		const total = weights.weak + weights.normal + weights.strong;
		if (total <= 0) {
			weights.weak = 0.33;
			weights.normal = 0.34;
			weights.strong = 0.33;
		} else {
			weights.weak = weights.weak / total;
			weights.normal = weights.normal / total;
			weights.strong = weights.strong / total;
		}
	}
	return merged;
}

export function getBiomeDeckConfig(): BiomeDeckConfig {
	return activeBiomeDeckConfig;
}

export function setBiomeDeckConfig(config: unknown): BiomeDeckConfig {
	activeBiomeDeckConfig = normalize(config);
	return activeBiomeDeckConfig;
}

export function loadBiomeDeckConfigFromFile(filePath: string): BiomeDeckConfig {
	const content = fs.readFileSync(filePath, 'utf8');
	return setBiomeDeckConfig(JSON.parse(content));
}

export function initializeBiomeDeckConfig(explicitPath?: string): BiomeDeckConfig {
	if (explicitPath) {
		return loadBiomeDeckConfigFromFile(path.resolve(explicitPath));
	}
	const defaultPath = path.resolve(process.cwd(), 'config', 'biome-decks.json');
	if (fs.existsSync(defaultPath)) {
		return loadBiomeDeckConfigFromFile(defaultPath);
	}
	return setBiomeDeckConfig(DEFAULT_BIOME_DECK_CONFIG);
}
