import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {
	DEFAULT_ARMOR_PROTECTION,
	DEFAULT_HEALING_AMOUNT,
	DEFAULT_ITEM_CONSUMABLES,
	DEFAULT_ITEM_VARIANT_MODIFIERS,
	DEFAULT_MONSTER_TIER_BASE,
	DEFAULT_MONSTER_CONSUMABLES,
	DEFAULT_MONSTER_VARIANT_MODIFIERS,
	DEFAULT_PLAYER_STATE,
	DEFAULT_WEAPON_DAMAGE,
	DEFAULT_ITEM_TIER_BASE,
} from './catalog/deck.js';
import { DESERT_ITEM_CATALOG, FIST_ITEM, FOREST_ITEM_CATALOG, VOLCANO_ITEM_CATALOG } from './catalog/items.js';
import {
	DESERT_MONSTER_CATALOG,
	EVIL_PRINCESS_MONSTER,
	FOREST_MONSTER_CATALOG,
	VOLCANO_MONSTER_CATALOG,
} from './catalog/monsters.js';
import type {
	ItemCatalogSourceEntry,
	ItemConsumableBalanceRange,
	ItemDef,
	ItemTierDeck,
	ItemVariant,
} from './models/itemTypes.js';
import type {
	MonsterConsumableBalanceRange,
	MonsterDef,
	MonsterTierDeck,
	MonsterVariant,
} from './models/monsterTypes.js';

type DeckType = ItemTierDeck;
type CardKind = 'monster' | 'item' | 'heart' | 'chest';
type DeckKind = 'encounter' | 'loot';
type PlayBiome = 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';

type WeaponBalanceOverrides = Partial<
	Record<DeckType, { minAttack?: number; maxAttack?: number; minChance?: number; maxChance?: number }>
>;
type ArmorBalanceOverrides = Partial<
	Record<DeckType, { minDefense?: number; maxDefense?: number; minChance?: number; maxChance?: number }>
>;
type ItemVarianceOverrides = Partial<Record<ItemVariant, { valueDelta?: number; chanceDelta?: number }>>;
type HealingOverrides = {
	smallPotionHeal?: number;
	mediumPotionHeal?: number;
	largePotionHeal?: number;
};
type MonsterTierOverrides = Partial<
	Record<
		DeckType,
		{
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
		}
	>
>;
type MonsterVarianceOverrides = Partial<
	Record<
		MonsterVariant,
		{
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
		}
	>
>;

type BalanceJsonConfig = {
	weapons?: WeaponBalanceOverrides;
	armors?: ArmorBalanceOverrides;
	itemVariance?: ItemVarianceOverrides;
	consumables?: HealingOverrides;
	itemConsumables?: Partial<Record<DeckType, Partial<ItemConsumableBalanceRange>>>;
	monsterConsumables?: Partial<Record<DeckType, Partial<MonsterConsumableBalanceRange>>>;
	monsters?: MonsterTierOverrides;
	monsterVariance?: MonsterVarianceOverrides;
	DEFAULT_HEALING_AMOUNT?: Partial<typeof DEFAULT_HEALING_AMOUNT>;
	DEFAULT_WEAPON_DAMAGE?: WeaponBalanceOverrides;
	DEFAULT_ARMOR_PROTECTION?: ArmorBalanceOverrides;
	DEFAULT_ITEM_CONSUMABLES?: Partial<Record<DeckType, Partial<ItemConsumableBalanceRange>>>;
	DEFAULT_ITEM_VARIANT_MODIFIERS?: ItemVarianceOverrides;
	DEFAULT_MONSTER_TIER_BASE?: MonsterTierOverrides;
	DEFAULT_MONSTER_CONSUMABLES?: Partial<Record<DeckType, Partial<MonsterConsumableBalanceRange>>>;
	DEFAULT_MONSTER_VARIANT_MODIFIERS?: MonsterVarianceOverrides;
};

type GeneratorConfig = {
	outPath?: string;
	defaults?: BalanceJsonConfig;
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
	deckConsumables: Record<DeckType, ItemConsumableBalanceRange>;
};

type MonsterBalanceProfile = {
	biomeTierBaseStats: typeof DEFAULT_MONSTER_TIER_BASE;
	variantModifiers: typeof DEFAULT_MONSTER_VARIANT_MODIFIERS;
	deckConsumables: Record<DeckType, MonsterConsumableBalanceRange>;
};

type DeckConsumableCounts = {
	teleport: number;
	smallHealthPotion: number;
	mediumHealthPotion: number;
	largeHealthPotion: number;
	fullHealthPotion: number;
	extraHeart: number;
	chest?: number;
};

type DeckCard = {
	kind: CardKind;
	id: string;
	hearts?: number;
	name?: string;
	variant?: MonsterVariant | ItemVariant;
	type?: 'weapon' | 'armor' | 'item';
	img?: string | null;
	effect?: string | null;
	heal?: number | null;
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

const DECK_ORDER: DeckType[] = ['easy', 'medium', 'hard'];
const ITEM_VARIANTS: ItemVariant[] = ['cracked', 'normal', 'enchanted'];
const MONSTER_VARIANTS: MonsterVariant[] = ['weak', 'normal', 'strong'];

const PLAY_BIOMES_BY_DECK_TYPE: Record<DeckType, PlayBiome[]> = {
	easy: ['plains', 'forest'],
	medium: ['desert'],
	hard: ['cave', 'volcano'],
};

const GENERATION_TEMPLATE: Record<
	DeckType,
	{
		encounter: { item: number; consumable: number; heart: number; chest: number };
		loot: { consumable: number; heart: number };
	}
> = {
	easy: {
		encounter: { item: 5, consumable: 4, heart: 1, chest: 1 },
		loot: { consumable: 3, heart: 2 },
	},
	medium: {
		encounter: { item: 8, consumable: 5, heart: 1, chest: 1 },
		loot: { consumable: 1, heart: 4 },
	},
	hard: {
		encounter: { item: 7, consumable: 2, heart: 2, chest: 1 },
		loot: { consumable: 1, heart: 1 },
	},
};

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

function toItemVariantMeta(itemId: string): { variant: ItemVariant; baseId: string } {
	if (itemId.startsWith('cracked_')) {
		return { variant: 'cracked', baseId: itemId.replace(/^cracked_/, '') };
	}
	if (itemId.startsWith('enchanted_')) {
		return { variant: 'enchanted', baseId: itemId.replace(/^enchanted_/, '') };
	}
	return { variant: 'normal', baseId: itemId };
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
	const parts = dotPath
		.split('.')
		.map(part => part.trim())
		.filter(Boolean);
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
			deepMerge(
				deepMerge(configFromFile.defaults ?? {}, configFromFile.balance ?? {}),
				balanceFromPath as Record<string, unknown>
			),
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
		deckConsumables: structuredClone(DEFAULT_ITEM_CONSUMABLES),
	};
}

function getDefaultMonsterProfile(): MonsterBalanceProfile {
	return {
		biomeTierBaseStats: structuredClone(DEFAULT_MONSTER_TIER_BASE),
		variantModifiers: structuredClone(DEFAULT_MONSTER_VARIANT_MODIFIERS),
		deckConsumables: structuredClone(DEFAULT_MONSTER_CONSUMABLES),
	};
}

function applyBalanceOverrides(
	itemProfile: ItemBalanceProfile,
	monsterProfile: MonsterBalanceProfile,
	balance: BalanceJsonConfig
): void {
	if (balance.DEFAULT_WEAPON_DAMAGE) {
		for (const deck of DECK_ORDER) {
			itemProfile.biomeTierBase.weapon[deck] = {
				...itemProfile.biomeTierBase.weapon[deck],
				...(balance.DEFAULT_WEAPON_DAMAGE[deck] ?? {}),
			};
		}
	}

	if (balance.DEFAULT_ARMOR_PROTECTION) {
		for (const deck of DECK_ORDER) {
			itemProfile.biomeTierBase.armor[deck] = {
				...itemProfile.biomeTierBase.armor[deck],
				...(balance.DEFAULT_ARMOR_PROTECTION[deck] ?? {}),
			};
		}
	}

	if (balance.DEFAULT_ITEM_VARIANT_MODIFIERS) {
		for (const variant of ITEM_VARIANTS) {
			itemProfile.variantModifiers[variant] = {
				...itemProfile.variantModifiers[variant],
				...(balance.DEFAULT_ITEM_VARIANT_MODIFIERS[variant] ?? {}),
			};
		}
	}

	if (balance.DEFAULT_HEALING_AMOUNT) {
		itemProfile.consumables = {
			...itemProfile.consumables,
			smallPotionHeal: balance.DEFAULT_HEALING_AMOUNT.smallHealthPotion ?? itemProfile.consumables.smallPotionHeal,
			mediumPotionHeal:
				balance.DEFAULT_HEALING_AMOUNT.mediumHealthPotion ?? itemProfile.consumables.mediumPotionHeal,
			largePotionHeal: balance.DEFAULT_HEALING_AMOUNT.largeHealthPotion ?? itemProfile.consumables.largePotionHeal,
		};
	}

	if (balance.DEFAULT_ITEM_CONSUMABLES) {
		for (const deck of DECK_ORDER) {
			itemProfile.deckConsumables[deck] = {
				...itemProfile.deckConsumables[deck],
				...(balance.DEFAULT_ITEM_CONSUMABLES[deck] ?? {}),
			};
		}
	}

	if (balance.DEFAULT_MONSTER_TIER_BASE) {
		for (const deck of DECK_ORDER) {
			monsterProfile.biomeTierBaseStats[deck] = {
				...monsterProfile.biomeTierBaseStats[deck],
				...(balance.DEFAULT_MONSTER_TIER_BASE[deck] ?? {}),
			};
		}
	}

	if (balance.DEFAULT_MONSTER_VARIANT_MODIFIERS) {
		for (const variant of MONSTER_VARIANTS) {
			const next = balance.DEFAULT_MONSTER_VARIANT_MODIFIERS[variant] ?? {};
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

	if (balance.DEFAULT_MONSTER_CONSUMABLES) {
		for (const deck of DECK_ORDER) {
			monsterProfile.deckConsumables[deck] = {
				...monsterProfile.deckConsumables[deck],
				...(balance.DEFAULT_MONSTER_CONSUMABLES[deck] ?? {}),
			};
		}
	}

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

	if (balance.itemConsumables) {
		for (const deck of DECK_ORDER) {
			itemProfile.deckConsumables[deck] = {
				...itemProfile.deckConsumables[deck],
				...(balance.itemConsumables[deck] ?? {}),
			};
		}
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

	if (balance.monsterConsumables) {
		for (const deck of DECK_ORDER) {
			monsterProfile.deckConsumables[deck] = {
				...monsterProfile.deckConsumables[deck],
				...(balance.monsterConsumables[deck] ?? {}),
			};
		}
	}
}

function toItemCard(item: ItemDef, variant?: ItemVariant): DeckCard {
	return {
		kind: 'item',
		id: item.id,
		name: item.name,
		variant,
		type: item.type,
		img: item.img ?? null,
		effect: item.effect ?? null,
		heal: item.heal ?? null,
		attack: item.attack ?? null,
		attackChance: item.attackChance ?? null,
		defense: item.defense ?? null,
		defenseChance: item.defenseChance ?? null,
	};
}

function toMonsterCard(monster: MonsterDef, variant: MonsterVariant): DeckCard {
	return {
		kind: 'monster',
		id: monster.id,
		name: monster.name,
		variant,
		img: monster.img,
		health: monster.health,
		attack: monster.attack,
		attackChance: monster.attackChance,
		defense: monster.defense,
		defenseChance: monster.defenseChance,
	};
}

function buildConsumableCounts(base: ItemConsumableBalanceRange | MonsterConsumableBalanceRange): DeckConsumableCounts {
	const counts: DeckConsumableCounts = {
		teleport: Math.max(0, Math.floor(base.teleport)),
		smallHealthPotion: Math.max(0, Math.floor(base.smallHealthPotion)),
		mediumHealthPotion: Math.max(0, Math.floor(base.mediumHealthPotion)),
		largeHealthPotion: Math.max(0, Math.floor(base.largeHealthPotion)),
		fullHealthPotion: Math.max(0, Math.floor(base.fullHealthPotion)),
		extraHeart: Math.max(0, Math.floor(base.extraHeart)),
	};
	if ('chest' in base && typeof base.chest === 'number') {
		counts.chest = Math.max(0, Math.floor(base.chest));
	}
	return counts;
}

function buildDeckItemDefs(deck: DeckType, profile: ItemBalanceProfile): { all: ItemDef[]; normalOnly: ItemDef[] } {
	const sourceByDeck = {
		easy: FOREST_ITEM_CATALOG,
		medium: DESERT_ITEM_CATALOG,
		hard: VOLCANO_ITEM_CATALOG,
	};
	const source = [...sourceByDeck[deck]];
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
		if (entry.type === 'weapon') {
			const base = profile.biomeTierBase.weapon[deck];
			const attack = Math.max(
				2,
				Math.round(interpolate(base.minAttack, base.maxAttack, ratio)) + mods.valueDelta
			);
			const attackChance = clampChance(interpolate(base.minChance, base.maxChance, ratio) + mods.chanceDelta);
			return {
				id: toVariantId(entry.id, variant),
				name: toVariantName(entry.name, variant),
				type: 'weapon',
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
		all,
		normalOnly,
	};
}

function buildDeckMonsterDefs(deck: MonsterTierDeck, profile: MonsterBalanceProfile): MonsterDef[] {
	const sourceByDeck = {
		easy: FOREST_MONSTER_CATALOG,
		medium: DESERT_MONSTER_CATALOG,
		hard: VOLCANO_MONSTER_CATALOG,
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
	const deckData: Record<
		DeckType,
		{
			itemsAll: ItemDef[];
			itemsNormal: ItemDef[];
			monsters: MonsterDef[];
		}
	> = {
		easy: {
			...(() => {
				const items = buildDeckItemDefs('easy', itemProfile);
				return {
					itemsAll: items.all,
					itemsNormal: items.normalOnly,
					monsters: buildDeckMonsterDefs('easy', monsterProfile),
				};
			})(),
		},
		medium: {
			...(() => {
				const items = buildDeckItemDefs('medium', itemProfile);
				return {
					itemsAll: items.all,
					itemsNormal: items.normalOnly,
					monsters: buildDeckMonsterDefs('medium', monsterProfile),
				};
			})(),
		},
		hard: {
			...(() => {
				const items = buildDeckItemDefs('hard', itemProfile);
				return {
					itemsAll: items.all,
					itemsNormal: items.normalOnly,
					monsters: buildDeckMonsterDefs('hard', monsterProfile),
				};
			})(),
		},
	};

	const decks: Record<string, GeneratedDeck> = {};
	for (const deck of DECK_ORDER) {
		const template = GENERATION_TEMPLATE[deck];
		const deckNameEncounter = `${deck}_encounter`;
		const deckNameLoot = `${deck}_loot`;
		const monsters = deckData[deck].monsters;
		const lootItems = deckData[deck].itemsAll;

		const encounterCards: DeckCard[] = [
			...monsters.map(monster => {
				const variant: MonsterVariant = monster.id.startsWith('weak_')
					? 'weak'
					: monster.id.startsWith('strong_')
						? 'strong'
						: 'normal';
				return toMonsterCard(monster, variant);
			}),
		];

		const lootCards: DeckCard[] = [
			...lootItems
				.filter(item => item.type === 'weapon' || item.type === 'armor')
				.map(item => {
					const { variant } = toItemVariantMeta(item.id);
					return toItemCard(item, variant);
				}),
		];

		const encounterConsumables = buildConsumableCounts(monsterProfile.deckConsumables[deck]);

		decks[deckNameEncounter] = {
			deck: deckNameEncounter,
			cards: encounterCards,
			consumables: encounterConsumables,
		};
		decks[deckNameLoot] = {
			deck: deckNameLoot,
			cards: lootCards,
			consumables: buildConsumableCounts(itemProfile.deckConsumables[deck]),
		};
	}

	const startingWeapon = {
		id: FIST_ITEM.id,
		name: FIST_ITEM.name,
		type: FIST_ITEM.type,
		img: FIST_ITEM.img,
		effect: FIST_ITEM.effect ?? null,
		heal: FIST_ITEM.heal ?? null,
		defense: FIST_ITEM.defense ?? null,
		defenseChance: FIST_ITEM.defenseChance ?? null,
		attack: 1,
		attackChance: 0.5,
	};

	const finalBoss = {
		id: EVIL_PRINCESS_MONSTER.id,
		name: EVIL_PRINCESS_MONSTER.name,
		health: EVIL_PRINCESS_MONSTER.health,
		attack: EVIL_PRINCESS_MONSTER.attack,
		attackChance: EVIL_PRINCESS_MONSTER.attackChance,
		defense: EVIL_PRINCESS_MONSTER.defense,
		defenseChance: EVIL_PRINCESS_MONSTER.defenseChance,
		img: EVIL_PRINCESS_MONSTER.img,
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
		'final-boss': finalBoss,
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
