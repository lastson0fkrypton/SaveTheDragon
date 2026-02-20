import fs from 'node:fs';
import path from 'node:path';

type BiomeKey = 'plains' | 'forest' | 'desert' | 'cave' | 'volcano' | 'castle' | 'town';
type CombatBiomeKey = Exclude<BiomeKey, 'castle' | 'town'>;
type MonsterVariant = 'weak' | 'normal' | 'strong';
type ItemVariant = 'cracked' | 'normal' | 'enchanted';

type MonsterStats = {
	health: number;
	attack: number;
	attackChance: number;
	defense: number;
	defenseChance: number;
};

type WeaponTier = { attack: number; attackChance: number };
type ArmorTier = { defense: number; defenseChance: number };

export type GameBalanceConfig = {
	BIOME_ENCOUNTER_RATES: Record<BiomeKey, number>;
	BIOME_TIER_BASE_STATS: Record<CombatBiomeKey, MonsterStats>;
	BIOME_VARIANT_MODIFIERS: Record<MonsterVariant, MonsterStats>;
	ITEM_DROP_RATES: Record<BiomeKey, number>;
	ITEM_TIER_BASE: {
		weapon: Record<CombatBiomeKey, WeaponTier>;
		armor: Record<CombatBiomeKey, ArmorTier>;
	};
	ITEM_VARIANT_MODIFIERS: Record<ItemVariant, { valueDelta: number; chanceDelta: number }>;
	CONSUMABLES: {
		smallPotionHeal: number;
		mediumPotionHeal: number;
		largePotionHeal: number;
		fullPotionHeal: number;
	};
};

export const DEFAULT_GAME_BALANCE_CONFIG: GameBalanceConfig = {
	BIOME_ENCOUNTER_RATES: {
		plains: 0.5,
		forest: 0.6,
		desert: 0.7,
		cave: 0.8,
		volcano: 0.9,
		castle: 0.0,
		town: 0.0,
	},
	BIOME_TIER_BASE_STATS: {
		plains: { health: 3, attack: 2, attackChance: 0.5, defense: 1, defenseChance: 0.2 },
		forest: { health: 4, attack: 2, attackChance: 0.58, defense: 1, defenseChance: 0.28 },
		desert: { health: 9, attack: 3, attackChance: 0.7, defense: 2, defenseChance: 0.42 },
		cave: { health: 17, attack: 5, attackChance: 0.82, defense: 4, defenseChance: 0.58 },
		volcano: { health: 17, attack: 5, attackChance: 0.82, defense: 4, defenseChance: 0.58 },
	},
	BIOME_VARIANT_MODIFIERS: {
		weak: { health: -1, attack: -1, attackChance: -0.08, defense: -1, defenseChance: -0.08 },
		normal: { health: 0, attack: 0, attackChance: 0, defense: 0, defenseChance: 0 },
		strong: { health: 1, attack: 1, attackChance: 0.08, defense: 1, defenseChance: 0.08 },
	},
	ITEM_DROP_RATES: {
		plains: 0.5,
		forest: 0.6,
		desert: 0.7,
		cave: 0.8,
		volcano: 0.9,
		castle: 0.0,
		town: 0.0,
	},
	ITEM_TIER_BASE: {
		weapon: {
			plains: { attack: 2, attackChance: 0.5153 },
			forest: { attack: 2, attackChance: 0.5153 },
			desert: { attack: 5, attackChance: 0.6353 },
			cave: { attack: 7, attackChance: 0.7353 },
			volcano: { attack: 7, attackChance: 0.7353 },
		},
		armor: {
			plains: { defense: 2, defenseChance: 0.5153 },
			forest: { defense: 2, defenseChance: 0.5153 },
			desert: { defense: 5, defenseChance: 0.6353 },
			cave: { defense: 7, defenseChance: 0.7353 },
			volcano: { defense: 7, defenseChance: 0.7353 },
		},
	},
	ITEM_VARIANT_MODIFIERS: {
		cracked: { valueDelta: -1, chanceDelta: -0.0596 },
		normal: { valueDelta: 0, chanceDelta: 0 },
		enchanted: { valueDelta: 1, chanceDelta: 0.0596 },
	},
	CONSUMABLES: {
		smallPotionHeal: 4,
		mediumPotionHeal: 7,
		largePotionHeal: 11,
		fullPotionHeal: 999,
	},
};

let activeConfig: GameBalanceConfig = structuredClone(DEFAULT_GAME_BALANCE_CONFIG);
let activeConfigVersion = 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampChance(value: number): number {
	if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, Number(value.toFixed(4))));
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

function normalizeConfig(input: unknown): GameBalanceConfig {
	const merged = mergeKnownKeys(DEFAULT_GAME_BALANCE_CONFIG as Record<string, unknown>, input) as GameBalanceConfig;

	for (const biome of Object.keys(merged.BIOME_ENCOUNTER_RATES)) {
		merged.BIOME_ENCOUNTER_RATES[biome as BiomeKey] = clampChance(merged.BIOME_ENCOUNTER_RATES[biome as BiomeKey]);
	}

	for (const biome of Object.keys(merged.ITEM_DROP_RATES)) {
		merged.ITEM_DROP_RATES[biome as BiomeKey] = clampChance(merged.ITEM_DROP_RATES[biome as BiomeKey]);
	}

	return merged;
}

function applyConfig(nextConfig: GameBalanceConfig): void {
	activeConfig = nextConfig;
	activeConfigVersion += 1;
}

export function getGameBalanceConfig(): GameBalanceConfig {
	return activeConfig;
}

export function getGameBalanceConfigVersion(): number {
	return activeConfigVersion;
}

export function setGameBalanceConfig(config: unknown): GameBalanceConfig {
	const normalized = normalizeConfig(config);
	applyConfig(normalized);
	return activeConfig;
}

export function loadGameBalanceConfigFromFile(filePath: string): GameBalanceConfig {
	const fileContent = fs.readFileSync(filePath, 'utf8');
	const parsed = JSON.parse(fileContent);
	return setGameBalanceConfig(parsed);
}

export function initializeGameBalanceConfig(explicitPath?: string): GameBalanceConfig {
	if (explicitPath) {
		return loadGameBalanceConfigFromFile(path.resolve(explicitPath));
	}

	const defaultPath = path.resolve(process.cwd(), 'config', 'game-balance.json');
	if (fs.existsSync(defaultPath)) {
		return loadGameBalanceConfigFromFile(defaultPath);
	}

	return setGameBalanceConfig(DEFAULT_GAME_BALANCE_CONFIG);
}
