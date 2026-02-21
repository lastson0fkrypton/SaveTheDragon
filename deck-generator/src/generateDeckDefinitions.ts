import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {
	DEFAULT_ARMOR_DECK_BALANCE,
	DEFAULT_HEALING_AMOUNT,
	DEFAULT_ITEM_VARIANT_MODIFIERS,
	DEFAULT_MONSTER_DECK_BALANCE,
	DEFAULT_MONSTER_VARIANT_MODIFIERS,
	DEFAULT_PLAYER_STATE,
 	DEFAULT_WEAPON_DECK_BALANCE,
} from './catalog/deck.js';
import {
	CONSUMABLE_ITEM_CATALOG,
	DESERT_ITEM_CATALOG,
	FIST_ITEM,
	FOREST_ITEM_CATALOG,
	VOLCANO_ITEM_CATALOG,
} from './catalog/items.js';
import {
	DESERT_MONSTER_CATALOG,
	EVIL_PRINCESS_MONSTER,
	FOREST_MONSTER_CATALOG,
	VOLCANO_MONSTER_CATALOG,
} from './catalog/monsters.js';
import type { ItemCatalogSourceEntry, ItemDef, ItemTierDeck, ItemVariant } from './models/itemTypes.js';
import type { MonsterDef, MonsterTierDeck, MonsterVariant } from './models/monsterTypes.js';

const DEFAULT_ITEM_TIER_BASE = {
	weapon: DEFAULT_WEAPON_DECK_BALANCE,
	armor: DEFAULT_ARMOR_DECK_BALANCE,
};

const DEFAULT_MONSTER_TIER_BASE_STATS = DEFAULT_MONSTER_DECK_BALANCE;

type DeckType = ItemTierDeck;
type CardKind = 'monster' | 'item' | 'heart' | 'chest';
type DeckKind = 'encounter' | 'loot';
type PlayBiome = 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';

type BalanceJsonConfig = {
	weapons?: Partial<Record<DeckType, { minAttack?: number; maxAttack?: number; minChance?: number; maxChance?: number }>>;
	armors?: Partial<Record<DeckType, { minDefense?: number; maxDefense?: number; minChance?: number; maxChance?: number }>>;
	itemVariance?: Partial<Record<ItemVariant, { valueDelta?: number; chanceDelta?: number }>>;
	consumables?: {
		smallPotionHeal?: number;
		mediumPotionHeal?: number;
		largePotionHeal?: number;
	};
	monsters?: Partial<Record<DeckType, {
		minHealth?: number;
		maxHealth?: number;
		minAttack?: number;
		maxAttack?: number;
		minAttackChance?: number;
		maxAttackChance?: number;
		minDefense?: number;
		maxDefense?: number;
		minDefenseChance?: number;
		maxDefenseChance?: number;
	}>>;
	monsterVariance?: Partial<Record<MonsterVariant, {
		healthDelta?: number;
		attackDelta?: number;
		attackChanceDelta?: number;
		defenseDelta?: number;
		defenseChanceDelta?: number;
		health?: number;
		attack?: number;
		attackChance?: number;
		defense?: number;
		defenseChance?: number;
	}>>;
};

type GeneratorConfig = {
	outPath?: string;
	balance?: BalanceJsonConfig;
};

type Args = {
	outPath: string;
	balancePath?: string;
	configPath?: string;
	balanceJson?: string;
	setPairs: string[];
};

type ItemBalanceProfile = {
	biomeTierBase: typeof DEFAULT_ITEM_TIER_BASE;
	variantModifiers: typeof DEFAULT_ITEM_VARIANT_MODIFIERS;
	consumables: {
		smallPotionHeal: number;
		mediumPotionHeal: number;
		largePotionHeal: number;
	};
};

type MonsterBalanceProfile = {
	biomeTierBaseStats: typeof DEFAULT_MONSTER_TIER_BASE_STATS;
	variantModifiers: typeof DEFAULT_MONSTER_VARIANT_MODIFIERS;
};

type DeckConsumableCounts = {
	teleport: number;
	smallHealthPotion: number;
	mediumHealthPotion: number;
	largeHealthPotion: number;
	fullHealthPotion: number;
	extraHeart: number;
};

type DeckCard = {
	kind: CardKind;
	id: string;
	hearts?: number;
	name?: string;
	variant?: MonsterVariant | ItemVariant;
	baseId?: string;
	health?: number | null;
	attack?: number | null;
	attackChance?: number | null;
	defense?: number | null;
	defenseChance?: number | null;
};

type GeneratedDeck = {
	deck: string;
	cards: DeckCard[];
	consumables: DeckConsumableCounts;
};

const DECK_ORDER: DeckType[] = ['forest', 'desert', 'volcano'];
const ITEM_VARIANTS: ItemVariant[] = ['cracked', 'normal', 'enchanted'];
const MONSTER_VARIANTS: MonsterVariant[] = ['weak', 'normal', 'strong'];

const BIOME_TAG_BY_DECK: Record<DeckType, string> = {
	forest: 'plains,forest',
	desert: 'desert',
	volcano: 'volcano,cave',
};

const PLAY_BIOMES_BY_DECK_TYPE: Record<DeckType, PlayBiome[]> = {
	forest: ['plains', 'forest'],
	desert: ['desert'],
	volcano: ['cave', 'volcano'],
};

const GENERATION_TEMPLATE: Record<DeckType, {
	encounter: { item: number; consumable: number; heart: number; chest: number };
	loot: { consumable: number; heart: number };
}> = {
	forest: {
		encounter: { item: 5, consumable: 4, heart: 1, chest: 1 },
		loot: { consumable: 3, heart: 2 },
	},
	desert: {
		encounter: { item: 8, consumable: 5, heart: 1, chest: 1 },
		loot: { consumable: 1, heart: 4 },
	},
	volcano: {
		encounter: { item: 7, consumable: 2, heart: 2, chest: 1 },
		loot: { consumable: 1, heart: 1 },
	},
};

const CONSUMABLE_ROTATION: Array<keyof Omit<DeckConsumableCounts, 'extraHeart'>> = [
	'smallHealthPotion',
	'mediumHealthPotion',
	'largeHealthPotion',
	'teleport',
	'fullHealthPotion',
];

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function clampChance(value: number): number {
	return clamp(Number(value.toFixed(4)), 0.05, 0.95);
}

function interpolate(min: number, max: number, ratio: number): number {
	return min + (max - min) * ratio;
}

function toVariantId(baseId: string, variant: ItemVariant): string {
	if (variant === 'cracked') return `cracked_${baseId}`;
	if (variant === 'enchanted') return `enchanted_${baseId}`;
	return baseId;
}

function toVariantName(baseName: string, variant: ItemVariant): string {
	if (variant === 'cracked') return `Cracked ${baseName}`;
	if (variant === 'enchanted') return `Enchanted ${baseName}`;
	return baseName;
}

function toMonsterVariantId(baseId: string, variant: MonsterVariant): string {
	if (variant === 'weak') return `weak_${baseId}`;
	if (variant === 'strong') return `strong_${baseId}`;
	return baseId;
}

function toMonsterVariantName(baseName: string, variant: MonsterVariant): string {
	if (variant === 'weak') return `Weak ${baseName}`;
	if (variant === 'strong') return `Strong ${baseName}`;
	return baseName;
}

function isWeaponCatalogEntry(item: ItemCatalogSourceEntry): item is ItemCatalogSourceEntry & { type: 'weapon' } {
	return item.type === 'weapon';
}

function isArmorCatalogEntry(item: ItemCatalogSourceEntry): item is ItemCatalogSourceEntry & { type: 'armor' } {
	return item.type === 'armor';
}

function parseValue(rawValue: string): unknown {
	if (rawValue === 'true') return true;
	if (rawValue === 'false') return false;
	if (rawValue === 'null') return null;
	if (rawValue !== '' && !Number.isNaN(Number(rawValue))) return Number(rawValue);
	try {
		return JSON.parse(rawValue);
	} catch {
		return rawValue;
	}
}

function setByPath(target: Record<string, unknown>, dotPath: string, rawValue: string): void {
	const parts = dotPath.split('.').map(part => part.trim()).filter(Boolean);
	if (parts.length === 0) {
		throw new Error(`Invalid --set path '${dotPath}'`);
	}
	let cursor: Record<string, unknown> = target;
	for (let index = 0; index < parts.length - 1; index += 1) {
		const key = parts[index];
		const next = cursor[key];
		if (!next || typeof next !== 'object' || Array.isArray(next)) {
			cursor[key] = {};
		}
		cursor = cursor[key] as Record<string, unknown>;
	}
	cursor[parts[parts.length - 1]] = parseValue(rawValue);
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
	const out = structuredClone(base) as Record<string, unknown>;
	for (const [key, value] of Object.entries(patch)) {
		if (
			value &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			out[key] &&
			typeof out[key] === 'object' &&
			!Array.isArray(out[key])
		) {
			out[key] = deepMerge(out[key] as Record<string, unknown>, value as Record<string, unknown>);
			continue;
		}
		out[key] = value;
	}
	return out as T;
}

function parseArgs(argv: string[]): Args {
	let outPath = path.resolve(process.cwd(), '..', 'server', 'config', 'deck-definitions.json');
	let balancePath: string | undefined;
	let configPath: string | undefined;
	let balanceJson: string | undefined;
	const setPairs: string[] = [];

	for (const arg of argv) {
		if (arg.startsWith('--out=')) {
			outPath = path.resolve(arg.slice('--out='.length));
			continue;
		}
		if (arg.startsWith('--balance=')) {
			balancePath = path.resolve(arg.slice('--balance='.length));
			continue;
		}
		if (arg.startsWith('--config=')) {
			configPath = path.resolve(arg.slice('--config='.length));
			continue;
		}
		if (arg.startsWith('--balance-json=')) {
			balanceJson = arg.slice('--balance-json='.length);
			continue;
		}
		if (arg.startsWith('--set=')) {
			setPairs.push(arg.slice('--set='.length));
		}
	}

	if (!balancePath) {
		const defaultBalancePath = path.resolve(process.cwd(), 'balance.json');
		if (fsSync.existsSync(defaultBalancePath)) {
			balancePath = defaultBalancePath;
		}
	}

	return { outPath, balancePath, configPath, balanceJson, setPairs };
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown>> {
	const raw = await fs.readFile(filePath, 'utf8');
	return JSON.parse(raw) as Record<string, unknown>;
}

async function resolveConfig(args: Args): Promise<{ outPath: string; balance: BalanceJsonConfig }> {
	let configFromFile: GeneratorConfig = {};
	if (args.configPath) {
		const parsed = await readJsonIfExists(args.configPath);
		configFromFile = parsed as GeneratorConfig;
	}

	let balanceFromPath: BalanceJsonConfig = {};
	if (args.balancePath) {
		balanceFromPath = (await readJsonIfExists(args.balancePath)) as BalanceJsonConfig;
	}

	let balanceFromInline: BalanceJsonConfig = {};
	if (args.balanceJson) {
		balanceFromInline = JSON.parse(args.balanceJson) as BalanceJsonConfig;
	}

	const setPatch: Record<string, unknown> = {};
	for (const pair of args.setPairs) {
		const separator = pair.indexOf('=');
		if (separator < 1) {
			throw new Error(`Invalid --set entry '${pair}'. Expected --set=path.to.value=123`);
		}
		const keyPath = pair.slice(0, separator);
		const rawValue = pair.slice(separator + 1);
		setByPath(setPatch, keyPath, rawValue);
	}

	const balance = deepMerge(
		deepMerge(
			deepMerge(configFromFile.balance ?? {}, balanceFromPath as Record<string, unknown>),
			balanceFromInline as Record<string, unknown>
		),
		setPatch
	) as BalanceJsonConfig;

	const outPath = configFromFile.outPath ? path.resolve(configFromFile.outPath) : args.outPath;
	return { outPath, balance };
}

function getDefaultItemProfile(): ItemBalanceProfile {
	return {
		biomeTierBase: structuredClone(DEFAULT_ITEM_TIER_BASE),
		variantModifiers: structuredClone(DEFAULT_ITEM_VARIANT_MODIFIERS),
		consumables: {
			smallPotionHeal: DEFAULT_HEALING_AMOUNT.smallHealthPotion,
			mediumPotionHeal: DEFAULT_HEALING_AMOUNT.mediumHealthPotion,
			largePotionHeal: DEFAULT_HEALING_AMOUNT.largeHealthPotion,
		},
	};
}

function getDefaultMonsterProfile(): MonsterBalanceProfile {
	return {
		biomeTierBaseStats: structuredClone(DEFAULT_MONSTER_TIER_BASE_STATS),
		variantModifiers: structuredClone(DEFAULT_MONSTER_VARIANT_MODIFIERS),
	};
}

function applyBalanceOverrides(
	itemProfile: ItemBalanceProfile,
	monsterProfile: MonsterBalanceProfile,
	balance: BalanceJsonConfig
): void {
	if (balance.weapons) {
		for (const deck of DECK_ORDER) {
			itemProfile.biomeTierBase.weapon[deck] = {
				...itemProfile.biomeTierBase.weapon[deck],
				...(balance.weapons[deck] ?? {}),
			};
		}
	}

	if (balance.armors) {
		for (const deck of DECK_ORDER) {
			itemProfile.biomeTierBase.armor[deck] = {
				...itemProfile.biomeTierBase.armor[deck],
				...(balance.armors[deck] ?? {}),
			};
		}
	}

	if (balance.itemVariance) {
		for (const variant of ITEM_VARIANTS) {
			itemProfile.variantModifiers[variant] = {
				...itemProfile.variantModifiers[variant],
				...(balance.itemVariance[variant] ?? {}),
			};
		}
	}

	if (balance.consumables) {
		itemProfile.consumables = {
			...itemProfile.consumables,
			...balance.consumables,
		};
	}

	if (balance.monsters) {
		for (const deck of DECK_ORDER) {
			monsterProfile.biomeTierBaseStats[deck] = {
				...monsterProfile.biomeTierBaseStats[deck],
				...(balance.monsters[deck] ?? {}),
			};
		}
	}

	if (balance.monsterVariance) {
		for (const variant of MONSTER_VARIANTS) {
			const next = balance.monsterVariance[variant] ?? {};
			const normalizedNext = {
				healthDelta: next.healthDelta ?? next.health,
				attackDelta: next.attackDelta ?? next.attack,
				attackChanceDelta: next.attackChanceDelta ?? next.attackChance,
				defenseDelta: next.defenseDelta ?? next.defense,
				defenseChanceDelta: next.defenseChanceDelta ?? next.defenseChance,
			};
			monsterProfile.variantModifiers[variant] = {
				...monsterProfile.variantModifiers[variant],
				...normalizedNext,
			};
		}
	}
}

function toItemCard(item: ItemDef, variant?: ItemVariant, baseId?: string): DeckCard {
	return {
		kind: 'item',
		id: item.id,
		name: item.name,
		variant,
		baseId,
		attack: item.attack ?? null,
		attackChance: item.attackChance ?? null,
		defense: item.defense ?? null,
		defenseChance: item.defenseChance ?? null,
	};
}

function toMonsterCard(monster: MonsterDef, variant: MonsterVariant, baseId: string): DeckCard {
	return {
		kind: 'monster',
		id: monster.id,
		name: monster.name,
		variant,
		baseId,
		health: monster.health,
		attack: monster.attack,
		attackChance: monster.attackChance,
		defense: monster.defense,
		defenseChance: monster.defenseChance,
	};
}

function addRotationCounts(consumables: DeckConsumableCounts, count: number): void {
	for (let index = 0; index < count; index += 1) {
		const key = CONSUMABLE_ROTATION[index % CONSUMABLE_ROTATION.length];
		consumables[key] += 1;
	}
}

function buildConsumableCounts(consumableSlots: number, extraHeartCount: number): DeckConsumableCounts {
	const counts: DeckConsumableCounts = {
		teleport: 1,
		smallHealthPotion: 1,
		mediumHealthPotion: 1,
		largeHealthPotion: 1,
		fullHealthPotion: 1,
		extraHeart: Math.max(1, extraHeartCount),
	};

	addRotationCounts(counts, Math.max(0, consumableSlots));
	return counts;
}

function buildDeckItemDefs(
	deck: DeckType,
	profile: ItemBalanceProfile
): { all: ItemDef[]; normalOnly: ItemDef[] } {
	const sourceByDeck = {
		forest: FOREST_ITEM_CATALOG,
		desert: DESERT_ITEM_CATALOG,
		volcano: VOLCANO_ITEM_CATALOG,
	};
	const source = [...sourceByDeck[deck]].sort((left, right) => left.id.localeCompare(right.id));
	const weapons = source.filter(isWeaponCatalogEntry);
	const armors = source.filter(isArmorCatalogEntry);

	const all: ItemDef[] = [];
	const normalOnly: ItemDef[] = [];

	const createBalanced = (
		entry: { id: string; name: string; type: 'weapon' | 'armor'; img: string },
		variant: ItemVariant,
		ratio: number
	): ItemDef => {
		const mods = profile.variantModifiers[variant];
		const biome = BIOME_TAG_BY_DECK[deck];
		if (entry.type === 'weapon') {
			const base = profile.biomeTierBase.weapon[deck];
			const attack = Math.max(2, Math.round(interpolate(base.minAttack, base.maxAttack, ratio)) + mods.valueDelta);
			const attackChance = clampChance(interpolate(base.minChance, base.maxChance, ratio) + mods.chanceDelta);
			return {
				id: toVariantId(entry.id, variant),
				name: toVariantName(entry.name, variant),
				type: 'weapon',
				biome,
				img: entry.img,
				attack,
				attackChance,
			};
		}
		const base = profile.biomeTierBase.armor[deck];
		const defense = Math.max(1, Math.round(interpolate(base.minDefense, base.maxDefense, ratio)) + mods.valueDelta);
		const defenseChance = clampChance(interpolate(base.minChance, base.maxChance, ratio) + mods.chanceDelta);
		return {
			id: toVariantId(entry.id, variant),
			name: toVariantName(entry.name, variant),
			type: 'armor',
			biome,
			img: entry.img,
			defense,
			defenseChance,
		};
	};

	for (let index = 0; index < weapons.length; index += 1) {
		const entry = weapons[index];
		const ratio = weapons.length > 1 ? index / (weapons.length - 1) : 0;
		for (const variant of ITEM_VARIANTS) {
			const item = createBalanced(entry, variant, ratio);
			all.push(item);
			if (variant === 'normal') normalOnly.push(item);
		}
	}

	for (let index = 0; index < armors.length; index += 1) {
		const entry = armors[index];
		const ratio = armors.length > 1 ? index / (armors.length - 1) : 0;
		for (const variant of ITEM_VARIANTS) {
			const item = createBalanced(entry, variant, ratio);
			all.push(item);
			if (variant === 'normal') normalOnly.push(item);
		}
	}

	return {
		all: all.sort((left, right) => left.id.localeCompare(right.id)),
		normalOnly: normalOnly.sort((left, right) => left.id.localeCompare(right.id)),
	};
}

function buildConsumableDefs(profile: ItemBalanceProfile): ItemDef[] {
	return CONSUMABLE_ITEM_CATALOG.map(entry => {
		if (entry.id === 'small_potion') {
			return { id: entry.id, name: entry.name, type: 'item', effect: entry.effect, img: entry.img, heal: profile.consumables.smallPotionHeal };
		}
		if (entry.id === 'medium_potion') {
			return { id: entry.id, name: entry.name, type: 'item', effect: entry.effect, img: entry.img, heal: profile.consumables.mediumPotionHeal };
		}
		if (entry.id === 'large_potion') {
			return { id: entry.id, name: entry.name, type: 'item', effect: entry.effect, img: entry.img, heal: profile.consumables.largePotionHeal };
		}
		if (entry.id === 'full_potion') {
			return { id: entry.id, name: entry.name, type: 'item', effect: entry.effect, img: entry.img };
		}
		return { id: entry.id, name: entry.name, type: 'item', effect: entry.effect, img: entry.img };
	});
}

function buildDeckMonsterDefs(deck: MonsterTierDeck, profile: MonsterBalanceProfile): MonsterDef[] {
	const sourceByDeck = {
		forest: FOREST_MONSTER_CATALOG,
		desert: DESERT_MONSTER_CATALOG,
		volcano: VOLCANO_MONSTER_CATALOG,
	};
	const source = [...sourceByDeck[deck]].sort((left, right) => left.id.localeCompare(right.id));
	const base = profile.biomeTierBaseStats[deck];

	const out: MonsterDef[] = [];
	for (let index = 0; index < source.length; index += 1) {
		const entry = source[index];
		const ratio = source.length > 1 ? index / (source.length - 1) : 0;
		const baseHealth = Math.max(1, Math.round(interpolate(base.minHealth, base.maxHealth, ratio)));
		const baseAttack = Math.max(1, Math.round(interpolate(base.minAttack, base.maxAttack, ratio)));
		const baseAttackChance = clampChance(interpolate(base.minAttackChance, base.maxAttackChance, ratio));
		const baseDefense = Math.max(0, Math.round(interpolate(base.minDefense, base.maxDefense, ratio)));
		const baseDefenseChance = clampChance(interpolate(base.minDefenseChance, base.maxDefenseChance, ratio));

		for (const variant of MONSTER_VARIANTS) {
			const mods = profile.variantModifiers[variant];
			out.push({
				id: toMonsterVariantId(entry.id, variant),
				name: toMonsterVariantName(entry.name, variant),
				biome: entry.biome,
				img: entry.img,
				health: Math.max(1, baseHealth + mods.healthDelta),
				attack: Math.max(1, baseAttack + mods.attackDelta),
				attackChance: clampChance(baseAttackChance + mods.attackChanceDelta),
				defense: Math.max(0, baseDefense + mods.defenseDelta),
				defenseChance: clampChance(baseDefenseChance + mods.defenseChanceDelta),
			});
		}
	}

	return out;
}

function buildDeckDefinitions(itemProfile: ItemBalanceProfile, monsterProfile: MonsterBalanceProfile) {
	const deckData: Record<DeckType, {
		itemsAll: ItemDef[];
		itemsNormal: ItemDef[];
		monsters: MonsterDef[];
	}> = {
		forest: {
			...(() => {
				const items = buildDeckItemDefs('forest', itemProfile);
				return { itemsAll: items.all, itemsNormal: items.normalOnly, monsters: buildDeckMonsterDefs('forest', monsterProfile) };
			})(),
		},
		desert: {
			...(() => {
				const items = buildDeckItemDefs('desert', itemProfile);
				return { itemsAll: items.all, itemsNormal: items.normalOnly, monsters: buildDeckMonsterDefs('desert', monsterProfile) };
			})(),
		},
		volcano: {
			...(() => {
				const items = buildDeckItemDefs('volcano', itemProfile);
				return { itemsAll: items.all, itemsNormal: items.normalOnly, monsters: buildDeckMonsterDefs('volcano', monsterProfile) };
			})(),
		},
	};

	const consumables = buildConsumableDefs(itemProfile);
	const itemDefinitions = [
		FIST_ITEM,
		...FOREST_ITEM_CATALOG,
		...DESERT_ITEM_CATALOG,
		...VOLCANO_ITEM_CATALOG,
		...CONSUMABLE_ITEM_CATALOG.map(item => ({ ...item, type: 'item' as const })),
	];

	const monsterDefinitions = [
		...FOREST_MONSTER_CATALOG,
		...DESERT_MONSTER_CATALOG,
		...VOLCANO_MONSTER_CATALOG,
	];

	const decks: Record<string, GeneratedDeck> = {};
	for (const deck of DECK_ORDER) {
		const template = GENERATION_TEMPLATE[deck];
		const deckNameEncounter = `${deck}_encounter`;
		const deckNameLoot = `${deck}_loot`;
		const monsters = deckData[deck].monsters;
		const encounterItems = deckData[deck].itemsAll.slice(0, Math.max(1, template.encounter.item));
		const lootItems = deckData[deck].itemsNormal;

		const encounterCards: DeckCard[] = [
			...monsters.map(monster => {
				const variant: MonsterVariant = monster.id.startsWith('weak_')
					? 'weak'
					: monster.id.startsWith('strong_')
						? 'strong'
						: 'normal';
				const baseMonsterId = variant === 'normal' ? monster.id : monster.id.replace(/^weak_|^strong_/, '');
				return toMonsterCard(monster, variant, baseMonsterId);
			}),
			...encounterItems.map(item => {
				const variant: ItemVariant = item.id.startsWith('cracked_')
					? 'cracked'
					: item.id.startsWith('enchanted_')
						? 'enchanted'
						: 'normal';
				const baseItemId = variant === 'normal' ? item.id : item.id.replace(/^cracked_|^enchanted_/, '');
				return toItemCard(item, variant, baseItemId);
			}),
			...Array.from({ length: Math.max(0, template.encounter.chest) }, (_, index) => ({
				kind: 'chest' as const,
				id: `${deck}_chest_${index + 1}`,
			})),
		];

		const lootCards: DeckCard[] = [
			...lootItems.map(item => toItemCard(item, 'normal', item.id)),
			...consumables.map(item => toItemCard(item, 'normal', item.id)),
		];

		decks[deckNameEncounter] = {
			deck: deckNameEncounter,
			cards: encounterCards,
			consumables: buildConsumableCounts(template.encounter.consumable, template.encounter.heart),
		};
		decks[deckNameLoot] = {
			deck: deckNameLoot,
			cards: lootCards,
			consumables: buildConsumableCounts(template.loot.consumable, template.loot.heart),
		};
	}

	const startingWeapon = {
		...FIST_ITEM,
		biome: 'any',
		attack: 1,
		attackChance: 0.5,
	};

	return {
		generatedAt: new Date().toISOString(),
		initialPlayerState: {
			playerHealth: DEFAULT_PLAYER_STATE.playerHealth,
			playerWeapon: startingWeapon,
			playerArmor: '',
		},
		healingAmount: {
			smallHealthPotion: itemProfile.consumables.smallPotionHeal,
			mediumHealthPotion: itemProfile.consumables.mediumPotionHeal,
			largeHealthPotion: itemProfile.consumables.largePotionHeal,
		},
		'final-boss': EVIL_PRINCESS_MONSTER,
		startingItems: {
			weapon: startingWeapon,
			armor: '',
		},
		itemDefinitions,
		monsterDefinitions,
		decks,
		meta: {
			deckBiomes: PLAY_BIOMES_BY_DECK_TYPE,
		},
	};
}

async function main() {
	const parsedArgs = parseArgs(process.argv.slice(2));
	const resolved = await resolveConfig(parsedArgs);
	const itemProfile = getDefaultItemProfile();
	const monsterProfile = getDefaultMonsterProfile();
	applyBalanceOverrides(itemProfile, monsterProfile, resolved.balance);

	const output = buildDeckDefinitions(itemProfile, monsterProfile);
	await fs.writeFile(resolved.outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
	console.log(`Generated deck definitions: ${resolved.outPath}`);
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
