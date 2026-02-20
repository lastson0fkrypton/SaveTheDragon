import type { MonsterDef } from '../types.js';
import { getGameBalanceConfig, getGameBalanceConfigVersion } from '../config/gameBalanceConfig.js';

export const EVIL_PRINCESS_MONSTER: MonsterDef = {
	id: 'evil_princess',
	name: 'Evil Princess',
	biome: 'castle',
	health: 120,
	attack: 8,
	attackChance: 0.85,
	defense: 5,
	defenseChance: 0.65,
	img: 'evil_princess.png',
};

type MonsterCatalogSourceEntry = {
	id: string;
	name: string;
	biome: string;
	img: string;
};

type MonsterCatalogBase = Pick<MonsterCatalogSourceEntry, 'id' | 'name' | 'biome' | 'img'>;

// --- Monster definitions ---
const MONSTER_CATALOG_SOURCE: ReadonlyArray<MonsterCatalogSourceEntry> = [
	// Plains/Forest
	{
		id: 'trollkin',
		name: 'Trollkin',
		biome: 'plains,forest',
		img: 'trollkin.png',
	},
	{
		id: 'bat',
		name: 'Bat',
		biome: 'plains,forest',
		img: 'bat.png',
	},
	{
		id: 'fairy',
		name: 'Fairy',
		biome: 'plains,forest',
		img: 'fairy.png',
	},
	{
		id: 'black_cat',
		name: 'Black Cat',
		biome: 'plains,forest',
		img: 'black_cat.png',
	},
	{
		id: 'goblin',
		name: 'Goblin',
		biome: 'plains,forest',
		img: 'goblin.png',
	},
	{
		id: 'bigfoot',
		name: 'Bigfoot',
		biome: 'plains,forest',
		img: 'bigfoot.png',
	},
	{
		id: 'giant_spider',
		name: 'Giant Spider',
		biome: 'plains,forest',
		img: 'giant_spider.png',
	},
	{
		id: 'ogre',
		name: 'Ogre',
		biome: 'plains,forest',
		img: 'ogre.png',
	},
	{
		id: 'warewolf',
		name: 'Warewolf',
		biome: 'plains,forest',
		img: 'warewolf.png',
	},
	// Desert
	{
		id: 'spiky_lizard',
		name: 'Spiky Lizard',
		biome: 'desert',
		img: 'spiky_lizard.png',
	},
	{
		id: 'scorpion',
		name: 'Scorpion',
		biome: 'desert',
		img: 'scorpion.png',
	},
	{
		id: 'snake',
		name: 'Snake',
		biome: 'desert',
		img: 'snake.png',
	},
	{
		id: 'vulture',
		name: 'Vulture',
		biome: 'desert',
		img: 'vulture.png',
	},
	{
		id: 'harpy',
		name: 'Harpy',
		biome: 'desert',
		img: 'harpy.png',
	},
	{
		id: 'centaur',
		name: 'Centaur',
		biome: 'desert',
		img: 'centaur.png',
	},
	{
		id: 'sand_golem',
		name: 'Sand Golem',
		biome: 'desert',
		img: 'sand_golem.png',
	},
	{
		id: 'pheonix',
		name: 'Pheonix',
		biome: 'desert',
		img: 'pheonix.png',
	},
	{
		id: 'gryphon',
		name: 'Gryphon',
		biome: 'desert',
		img: 'gryphon.png',
	},
	// Cave/Volcano
	{
		id: 'fire_butterfly',
		name: 'Fire Butterfly',
		biome: 'volcano,cave',
		img: 'fire_butterfly.png',
	},
	{
		id: 'magma_cube',
		name: 'Magma Cube',
		biome: 'volcano,cave',
		img: 'magma_cube.png',
	},
	{
		id: 'ember_imp',
		name: 'Ember Imp',
		biome: 'volcano,cave',
		img: 'ember_imp.png',
	},
	{
		id: 'skeleton',
		name: 'Skeleton',
		biome: 'volcano,cave',
		img: 'skeleton.png',
	},
	{
		id: 'rock_troll',
		name: 'Rock Troll',
		biome: 'volcano,cave',
		img: 'rock_troll.png',
	},
	{
		id: 'medusa',
		name: 'Medusa',
		biome: 'volcano,cave',
		img: 'medusa.png',
	},
	{
		id: 'wizard',
		name: 'Wizard',
		biome: 'volcano,cave',
		img: 'wizard.png',
	},
	{
		id: 'red_dragon',
		name: 'Red Dragon',
		biome: 'volcano,cave',
		img: 'red_dragon.png',
	},
	{
		id: 'dark_unicorn',
		name: 'Dark Unicorn',
		biome: 'volcano,cave',
		img: 'dark_unicorn.png',
	},
];

const BASE_MONSTER_DEFS: ReadonlyArray<MonsterCatalogBase> = MONSTER_CATALOG_SOURCE.map(monster => {
	const { id, name, biome, img } = monster;
	return {
		id,
		name,
		biome,
		img,
	};
});

const BIOME_EXPANDED_MONSTER_DEFS: ReadonlyArray<MonsterCatalogBase> = BASE_MONSTER_DEFS.flatMap(monster =>
	monster.biome
		.split(',')
		.map(part => part.trim())
		.filter(Boolean)
		.map(biome => ({
			id: monster.id,
			name: monster.name,
			biome,
			img: monster.img,
		}))
);

type MonsterVariant = 'weak' | 'normal' | 'strong';
type MonsterTierBiome = 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';

export type MonsterBalanceProfile = {
	biomeTierBaseStats: Record<MonsterTierBiome, {
		health: number;
		attack: number;
		attackChance: number;
		defense: number;
		defenseChance: number;
	}>;
	variantModifiers: Record<MonsterVariant, {
		health: number;
		attack: number;
		attackChance: number;
		defense: number;
		defenseChance: number;
	}>;
};

const MONSTER_VARIANTS: ReadonlyArray<MonsterVariant> = ['weak', 'normal', 'strong'];

export type MonsterBalanceProfileOverride = {
	biomeTierBaseStats?: Partial<Record<MonsterTierBiome, Partial<MonsterBalanceProfile['biomeTierBaseStats'][MonsterTierBiome]>>>;
	variantModifiers?: Partial<Record<MonsterVariant, Partial<MonsterBalanceProfile['variantModifiers'][MonsterVariant]>>>;
};

function getMonsterBalanceProfileFromConfig(): MonsterBalanceProfile {
	const config = getGameBalanceConfig();
	return {
		biomeTierBaseStats: structuredClone(config.BIOME_TIER_BASE_STATS),
		variantModifiers: structuredClone(config.BIOME_VARIANT_MODIFIERS),
	};
}

export const DEFAULT_MONSTER_BALANCE_PROFILE: MonsterBalanceProfile = getMonsterBalanceProfileFromConfig();

let cachedMonsterDefs: ReadonlyArray<MonsterDef> = [];
let cachedConfigVersion = -1;

function clampChance(value: number) {
	return Math.max(0.05, Math.min(0.95, Number(value.toFixed(2))));
}

function resolveBiomeTier(monsterBiome: string): MonsterTierBiome {
	const biomes = (monsterBiome || '').split(',').map(part => part.trim()).filter(Boolean);
	if (biomes.length === 0) {
		return 'plains';
	}

	const strongestFirst: MonsterTierBiome[] = ['volcano', 'cave', 'desert', 'forest', 'plains'];
	for (const biome of strongestFirst) {
		if (biomes.includes(biome)) {
			return biome;
		}
	}

	return 'plains';
}

function toVariantId(baseId: string, variant: MonsterVariant) {
	if (variant === 'weak') return `weak_${baseId}`;
	if (variant === 'strong') return `strong_${baseId}`;
	return baseId;
}

function toVariantName(baseName: string, variant: MonsterVariant) {
	if (variant === 'weak') return `Weak ${baseName}`;
	if (variant === 'strong') return `Strong ${baseName}`;
	return baseName;
}

function applyBiomeTierBalance(
	monsterDef: MonsterCatalogBase,
	profile: MonsterBalanceProfile,
	variant: MonsterVariant
): MonsterDef {
	const tierBiome = resolveBiomeTier(monsterDef.biome);
	const baseStats = profile.biomeTierBaseStats[tierBiome] || profile.biomeTierBaseStats.plains;
	const modifiers = profile.variantModifiers[variant] || profile.variantModifiers.normal;

	return {
		id: toVariantId(monsterDef.id, variant),
		name: toVariantName(monsterDef.name, variant),
		biome: monsterDef.biome,
		img: monsterDef.img,
		health: Math.max(1, baseStats.health + modifiers.health),
		attack: Math.max(1, baseStats.attack + modifiers.attack),
		attackChance: clampChance(baseStats.attackChance + modifiers.attackChance),
		defense: Math.max(0, baseStats.defense + modifiers.defense),
		defenseChance: clampChance(baseStats.defenseChance + modifiers.defenseChance),
	};
}

function buildMonsterDefs(profile: MonsterBalanceProfile): ReadonlyArray<MonsterDef> {
	return BIOME_EXPANDED_MONSTER_DEFS.flatMap(monsterDef =>
		MONSTER_VARIANTS.map(variant => applyBiomeTierBalance(monsterDef, profile, variant))
	);
}

function getOrBuildMonsterDefs(): ReadonlyArray<MonsterDef> {
	const nextVersion = getGameBalanceConfigVersion();
	if (cachedConfigVersion !== nextVersion) {
		cachedMonsterDefs = buildMonsterDefs(getMonsterBalanceProfileFromConfig());
		cachedConfigVersion = nextVersion;
	}
	return cachedMonsterDefs;
}

export function getMonsterDefs(): ReadonlyArray<MonsterDef> {
	return getOrBuildMonsterDefs();
}

export function getMonsterBalanceProfile(): MonsterBalanceProfile {
	return getMonsterBalanceProfileFromConfig();
}

export function resetMonsterBalanceProfile(): void {
	cachedConfigVersion = -1;
}

export function applyMonsterBalanceProfile(_overrides: MonsterBalanceProfileOverride): void {
	return;
}

resetMonsterBalanceProfile();

export const MONSTER_DEFS = buildMonsterDefs(DEFAULT_MONSTER_BALANCE_PROFILE);
