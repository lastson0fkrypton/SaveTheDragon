import fs from 'node:fs';
import path from 'node:path';
import type { DeckType } from './biomeTypes.js';
import type { ItemDef, MonsterDef } from '../types.js';

export type DeckKind = 'encounter' | 'loot' | 'quests';
export type DeckId =
	| 'easy_encounter'
	| 'easy_loot'
	| 'medium_encounter'
	| 'medium_loot'
	| 'hard_encounter'
	| 'hard_loot'
	| 'quests';

export type EncounterDeckCardDef = { kind: 'monster'; id: string };

export type LootDeckCardDef = { kind: 'item'; id: string };

export type QuestDeckCardDef = {
	kind: 'quest';
	id: string;
	name: string;
	description: string;
	rewardHearts: number;
	objectives: QuestObjective[];
	modifiers?: QuestModifiers;
};

export type DeckConsumableCounts = {
	teleport: number;
	smallHealthPotion: number;
	mediumHealthPotion: number;
	largeHealthPotion: number;
	fullHealthPotion: number;
	extraHeart: number;
	chest?: number;
};

export type DeckDefinition = {
	deck: DeckId;
	cards: Array<EncounterDeckCardDef | LootDeckCardDef | QuestDeckCardDef>;
	consumables: DeckConsumableCounts;
};

type PlayBiome = 'any' | 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';
type QuestMonsterVariant = 'weak' | 'regular' | 'strong';

export type QuestObjective =
	| {
		kind: 'visit';
		biome?: PlayBiome;
		count: number;
	}
	| {
		kind: 'visit_town';
		count: number;
	}
	| {
		kind: 'battle';
		kills: number;
		biome?: PlayBiome | null;
		variant?: QuestMonsterVariant | null;
	};

export type QuestModifiers = {
	withoutDying?: boolean;
	withoutUsingConsumables?: boolean;
	resetOnDeath?: boolean;
	requiresUnequippedItem?: boolean;
	withoutEnteringTown?: boolean;
	requiresConsumableThenWin?: boolean;
};

export type QuestDefinition = {
	id: string;
	title: string;
	description: string;
	rewardHearts: number;
	objectives: QuestObjective[];
	modifiers?: QuestModifiers;
};

export type DeckDefinitionsConfig = {
	initialPlayerState: {
		playerHealth: number;
		playerWeapon: ItemDef;
		playerArmor: ItemDef | '';
	};
	healingAmount?: {
		smallHealthPotion: number;
		mediumHealthPotion: number;
		largeHealthPotion: number;
	};
	'final-boss': MonsterDef;
	decks: Record<DeckId, DeckDefinition>;
	meta?: Record<string, unknown>;
};

const REQUIRED_DECK_IDS: DeckId[] = [
	'easy_encounter',
	'easy_loot',
	'medium_encounter',
	'medium_loot',
	'hard_encounter',
	'hard_loot',
	'quests',
];

let activeDeckDefinitionsConfig: DeckDefinitionsConfig | null = null;
let activeItemDefinitions: Record<string, ItemDef> = {};
let activeMonsterDefinitions: Record<string, MonsterDef> = {};
let activeLootDeckTypesByItemId: Record<string, DeckType[]> = {};

const DEFAULT_HEALING_AMOUNT = {
	smallHealthPotion: 3,
	mediumHealthPotion: 5,
	largeHealthPotion: 7,
};

const CONSUMABLE_ITEM_BY_KEY: Record<
	keyof DeckConsumableCounts,
	(itemHealing: { smallHealthPotion: number; mediumHealthPotion: number; largeHealthPotion: number }) => ItemDef | null
> = {
	teleport: () => ({ id: 'teleport', name: 'Teleport', type: 'item', img: 'teleport.png', effect: 'teleport', heal: null }),
	smallHealthPotion: healing => ({
		id: 'small_potion',
		name: 'Small Health Potion',
		type: 'item',
		img: 'small_potion.png',
		effect: 'heal_small',
		heal: healing.smallHealthPotion,
	}),
	mediumHealthPotion: healing => ({
		id: 'medium_potion',
		name: 'Medium Health Potion',
		type: 'item',
		img: 'medium_potion.png',
		effect: 'heal_medium',
		heal: healing.mediumHealthPotion,
	}),
	largeHealthPotion: healing => ({
		id: 'large_potion',
		name: 'Large Health Potion',
		type: 'item',
		img: 'large_potion.png',
		effect: 'heal_large',
		heal: healing.largeHealthPotion,
	}),
	fullHealthPotion: () => ({
		id: 'full_potion',
		name: 'Full Health Potion',
		type: 'item',
		img: 'full_potion.png',
		effect: 'heal_full',
		heal: null,
	}),
	extraHeart: () => ({
		id: 'extra_heart',
		name: 'Additional Heart',
		type: 'item',
		img: 'extra_heart.png',
		effect: 'extra_heart',
		heal: null,
	}),
	chest: () => null,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateItemDef(rawItem: unknown, label: string): ItemDef {
	if (!isPlainObject(rawItem)) {
		throw new Error(`Invalid item definition '${label}': expected object`);
	}

	if (typeof rawItem.id !== 'string' || rawItem.id.length === 0) {
		throw new Error(`Invalid item definition '${label}': missing id`);
	}
	if (typeof rawItem.name !== 'string' || rawItem.name.length === 0) {
		throw new Error(`Invalid item definition '${label}': missing name`);
	}
	if (rawItem.type !== 'weapon' && rawItem.type !== 'armor' && rawItem.type !== 'item') {
		throw new Error(`Invalid item definition '${label}': invalid type`);
	}

	const item: ItemDef = {
		id: rawItem.id,
		name: rawItem.name,
		type: rawItem.type,
		attack: typeof rawItem.attack === 'number' ? rawItem.attack : null,
		attackChance: typeof rawItem.attackChance === 'number' ? rawItem.attackChance : null,
		defense: typeof rawItem.defense === 'number' ? rawItem.defense : null,
		defenseChance: typeof rawItem.defenseChance === 'number' ? rawItem.defenseChance : null,
		heal: typeof rawItem.heal === 'number' ? rawItem.heal : null,
		effect: typeof rawItem.effect === 'string' ? rawItem.effect : null,
		img: typeof rawItem.img === 'string' ? rawItem.img : null,
	};

	return item;
}

function validateMonsterDef(rawMonster: unknown, label: string): MonsterDef {
	if (!isPlainObject(rawMonster)) {
		throw new Error(`Invalid monster definition '${label}': expected object`);
	}

	if (typeof rawMonster.id !== 'string' || rawMonster.id.length === 0) {
		throw new Error(`Invalid monster definition '${label}': missing id`);
	}
	if (typeof rawMonster.name !== 'string' || rawMonster.name.length === 0) {
		throw new Error(`Invalid monster definition '${label}': missing name`);
	}
	for (const field of ['health', 'attack', 'attackChance', 'defense', 'defenseChance'] as const) {
		if (typeof rawMonster[field] !== 'number' || !Number.isFinite(rawMonster[field])) {
			throw new Error(`Invalid monster definition '${label}': missing ${field}`);
		}
	}

	const health = rawMonster.health as number;
	const attack = rawMonster.attack as number;
	const attackChance = rawMonster.attackChance as number;
	const defense = rawMonster.defense as number;
	const defenseChance = rawMonster.defenseChance as number;

	return {
		id: rawMonster.id,
		name: rawMonster.name,
		health,
		attack,
		attackChance,
		defense,
		defenseChance,
		img: typeof rawMonster.img === 'string' ? rawMonster.img : '',
	};
}

function validateInitialPlayerState(rawInitialPlayerState: unknown): DeckDefinitionsConfig['initialPlayerState'] {
	if (!isPlainObject(rawInitialPlayerState)) {
		throw new Error('Invalid deck definitions config: missing initialPlayerState object');
	}

	if (typeof rawInitialPlayerState.playerHealth !== 'number' || !Number.isFinite(rawInitialPlayerState.playerHealth)) {
		throw new Error('Invalid deck definitions config: initialPlayerState.playerHealth must be a number');
	}

	const playerWeapon = validateItemDef(rawInitialPlayerState.playerWeapon, 'initialPlayerState.playerWeapon');
	if (playerWeapon.type !== 'weapon') {
		throw new Error('Invalid deck definitions config: initialPlayerState.playerWeapon must have type=weapon');
	}

	let playerArmor: ItemDef | '' = '';
	if (rawInitialPlayerState.playerArmor === '') {
		playerArmor = '';
	} else if (rawInitialPlayerState.playerArmor !== undefined && rawInitialPlayerState.playerArmor !== null) {
		const parsedArmor = validateItemDef(rawInitialPlayerState.playerArmor, 'initialPlayerState.playerArmor');
		if (parsedArmor.type !== 'armor') {
			throw new Error('Invalid deck definitions config: initialPlayerState.playerArmor must have type=armor or be empty string');
		}
		playerArmor = parsedArmor;
	}

	return {
		playerHealth: rawInitialPlayerState.playerHealth,
		playerWeapon,
		playerArmor,
	};
}

function validateHealingAmount(rawHealingAmount: unknown): DeckDefinitionsConfig['healingAmount'] | undefined {
	if (!isPlainObject(rawHealingAmount)) {
		return undefined;
	}

	const smallHealthPotion = rawHealingAmount.smallHealthPotion;
	const mediumHealthPotion = rawHealingAmount.mediumHealthPotion;
	const largeHealthPotion = rawHealingAmount.largeHealthPotion;

	for (const [key, value] of [
		['smallHealthPotion', smallHealthPotion],
		['mediumHealthPotion', mediumHealthPotion],
		['largeHealthPotion', largeHealthPotion],
	] as const) {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			throw new Error(`Invalid deck definitions config: healingAmount.${key} must be a number`);
		}
	}

	return {
		smallHealthPotion: smallHealthPotion as number,
		mediumHealthPotion: mediumHealthPotion as number,
		largeHealthPotion: largeHealthPotion as number,
	};
}

function getHealingAmountFromConfig(config: DeckDefinitionsConfig): {
	smallHealthPotion: number;
	mediumHealthPotion: number;
	largeHealthPotion: number;
} {
	if (!config.healingAmount) {
		return DEFAULT_HEALING_AMOUNT;
	}
	return config.healingAmount;
}

function validateCard(
	rawCard: unknown,
	deckId: DeckId,
	deckKind: DeckKind,
	index: number
): EncounterDeckCardDef | LootDeckCardDef | QuestDeckCardDef {
	if (!isPlainObject(rawCard)) {
		throw new Error(`Invalid card at ${deckId}[${index}]: expected object`);
	}

	const kind = rawCard.kind;
	const id = rawCard.id;
	const hearts = rawCard.hearts;

	if (typeof kind !== 'string') {
		throw new Error(`Invalid card at ${deckId}[${index}]: missing kind`);
	}
	if (typeof id !== 'string' || id.length === 0) {
		throw new Error(`Invalid card at ${deckId}[${index}]: missing id`);
	}

	if (deckKind === 'encounter' && kind !== 'monster') {
		throw new Error(`Invalid card at ${deckId}[${index}]: encounter deck cards must be kind 'monster'`);
	}

	if (deckKind === 'loot' && kind !== 'item') {
		throw new Error(`Invalid card at ${deckId}[${index}]: loot deck cards must be kind 'item'`);
	}

	if (deckKind === 'quests' && kind !== 'quest') {
		throw new Error(`Invalid card at ${deckId}[${index}]: quest deck cards must be kind 'quest'`);
	}

	if (deckKind === 'loot') {
		const cardType = rawCard.type;
		if (cardType !== 'weapon' && cardType !== 'armor') {
			throw new Error(`Invalid card at ${deckId}[${index}]: loot deck cards must be type 'weapon' or 'armor'`);
		}
	}

	if (kind === 'monster' || kind === 'item' || kind === 'chest' || kind === 'quest') {
		return { ...rawCard, kind, id } as EncounterDeckCardDef | LootDeckCardDef | QuestDeckCardDef;
	}

	throw new Error(`Invalid card at ${deckId}[${index}]: unsupported kind '${String(kind)}'`);
}

function toCount(value: unknown, fieldName: string, deckId: DeckId): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		throw new Error(`Invalid deck '${deckId}': consumables.${fieldName} must be a number >= 0`);
	}
	return Math.floor(value);
}

function validateConsumables(rawConsumables: unknown, deckId: DeckId): DeckConsumableCounts {
	if (!isPlainObject(rawConsumables)) {
		throw new Error(`Invalid deck '${deckId}': missing consumables object`);
	}

	return {
		teleport: toCount(rawConsumables.teleport, 'teleport', deckId),
		smallHealthPotion: toCount(rawConsumables.smallHealthPotion, 'smallHealthPotion', deckId),
		mediumHealthPotion: toCount(rawConsumables.mediumHealthPotion, 'mediumHealthPotion', deckId),
		largeHealthPotion: toCount(rawConsumables.largeHealthPotion, 'largeHealthPotion', deckId),
		fullHealthPotion: toCount(rawConsumables.fullHealthPotion, 'fullHealthPotion', deckId),
		extraHeart: toCount(rawConsumables.extraHeart, 'extraHeart', deckId),
		...(rawConsumables.chest !== undefined ? { chest: toCount(rawConsumables.chest, 'chest', deckId) } : {}),
	};
}

function validateDeck(rawDeck: unknown, deckId: DeckId): DeckDefinition {
	if (!isPlainObject(rawDeck)) {
		throw new Error(`Invalid deck '${deckId}': expected object`);
	}
	if (rawDeck.deck !== deckId) {
		throw new Error(`Invalid deck '${deckId}': deck field must equal '${deckId}'`);
	}
	if (!Array.isArray(rawDeck.cards)) {
		throw new Error(`Invalid deck '${deckId}': cards must be an array`);
	}

	const deckKind: DeckKind = deckId.endsWith('_encounter') ? 'encounter' : deckId.endsWith('_loot') ? 'loot' : 'quests';
	const cards = rawDeck.cards.map((card, index) => {
		const validated = validateCard(card, deckId, deckKind, index);
		if (deckKind !== 'quests') {
			return validated;
		}

		const questRaw = validated as Record<string, unknown>;
		if (!isPlainObject(questRaw)) {
			throw new Error(`Invalid card at ${deckId}[${index}]: quest card must be an object`);
		}
		if (typeof questRaw.name !== 'string' || questRaw.name.length === 0) {
			throw new Error(`Invalid card at ${deckId}[${index}]: quest card missing name`);
		}
		if (typeof questRaw.description !== 'string' || questRaw.description.length === 0) {
			throw new Error(`Invalid card at ${deckId}[${index}]: quest card missing description`);
		}
		const objectiveSource = questRaw.objectives;
		if (!Array.isArray(objectiveSource) || objectiveSource.length === 0) {
			throw new Error(`Invalid card at ${deckId}[${index}]: quest card objectives must be a non-empty array`);
		}

		return {
			kind: 'quest',
			id: String(questRaw.id),
			name: questRaw.name,
			description: questRaw.description,
			rewardHearts: toFiniteInt(questRaw.rewardHearts, `quest card '${String(questRaw.id)}' rewardHearts`, 0),
			objectives: objectiveSource.map((objective, objectiveIndex) =>
				validateQuestObjective(objective, String(questRaw.id), objectiveIndex)
			),
			modifiers: validateQuestModifiers(questRaw.modifiers),
		} as QuestDeckCardDef;
	});
	const consumables = validateConsumables(rawDeck.consumables, deckId);
	return {
		deck: deckId,
		cards,
		consumables,
	};
}

function toQuestBiome(raw: unknown, label: string): PlayBiome {
	if (raw === 'any' || raw === 'plains' || raw === 'forest' || raw === 'desert' || raw === 'cave' || raw === 'volcano') {
		return raw;
	}
	throw new Error(`Invalid ${label}: expected valid biome`);
}

function toQuestMonsterVariant(raw: unknown, label: string): QuestMonsterVariant {
	if (raw === 'weak' || raw === 'regular' || raw === 'strong') {
		return raw;
	}
	throw new Error(`Invalid ${label}: expected variant weak|regular|strong`);
}

function toFiniteInt(raw: unknown, label: string, min = 0): number {
	if (typeof raw !== 'number' || !Number.isFinite(raw)) {
		throw new Error(`Invalid ${label}: expected number`);
	}
	return Math.max(min, Math.floor(raw));
}

function validateQuestObjective(rawObjective: unknown, questId: string, objectiveIndex: number): QuestObjective {
	if (!isPlainObject(rawObjective)) {
		throw new Error(`Invalid quest '${questId}' objective[${objectiveIndex}]: must be an object`);
	}

	const objectiveKind = rawObjective.kind;
	if (objectiveKind === 'visit') {
		return {
			kind: 'visit',
			biome:
				rawObjective.biome === undefined || rawObjective.biome === null
					? undefined
					: toQuestBiome(rawObjective.biome, `quest '${questId}' objective[${objectiveIndex}] biome`),
			count: toFiniteInt(rawObjective.count, `quest '${questId}' objective[${objectiveIndex}] count`, 1),
		};
	}

	if (objectiveKind === 'visit_town') {
		return {
			kind: 'visit_town',
			count: toFiniteInt(rawObjective.count, `quest '${questId}' objective[${objectiveIndex}] town count`, 1),
		};
	}

	if (objectiveKind === 'battle') {
		return {
			kind: 'battle',
			kills: toFiniteInt(rawObjective.kills, `quest '${questId}' objective[${objectiveIndex}] kills`, 1),
			biome:
				rawObjective.biome === undefined || rawObjective.biome === null
					? null
					: toQuestBiome(rawObjective.biome, `quest '${questId}' objective[${objectiveIndex}] biome`),
			variant:
				rawObjective.variant === undefined || rawObjective.variant === null
					? null
					: toQuestMonsterVariant(rawObjective.variant, `quest '${questId}' objective[${objectiveIndex}] variant`),
		};
	}

	throw new Error(
		`Invalid quest '${questId}' objective[${objectiveIndex}]: unsupported kind '${String(objectiveKind)}'`
	);
}

function validateQuestModifiers(rawModifiers: unknown): QuestModifiers | undefined {
	if (!isPlainObject(rawModifiers)) {
		return undefined;
	}

	return {
		withoutDying: Boolean(rawModifiers.withoutDying),
		withoutUsingConsumables: Boolean(rawModifiers.withoutUsingConsumables),
		resetOnDeath: Boolean(rawModifiers.resetOnDeath),
		requiresUnequippedItem: Boolean(rawModifiers.requiresUnequippedItem),
		withoutEnteringTown: Boolean(rawModifiers.withoutEnteringTown),
		requiresConsumableThenWin: Boolean(rawModifiers.requiresConsumableThenWin),
	};
}

function normalizeConfig(input: unknown): DeckDefinitionsConfig {
	if (!isPlainObject(input)) {
		throw new Error('Invalid deck definitions config: expected object');
	}
	if (input.startingItems !== undefined) {
		throw new Error('Invalid deck definitions config: startingItems is no longer supported. Use initialPlayerState only.');
	}
	if (input.itemDefinitions !== undefined) {
		throw new Error('Invalid deck definitions config: itemDefinitions is no longer supported. Use self-contained item cards.');
	}
	if (input.monsterDefinitions !== undefined) {
		throw new Error('Invalid deck definitions config: monsterDefinitions is no longer supported. Use self-contained monster cards.');
	}

	const finalBoss = validateMonsterDef(input['final-boss'], 'final-boss');
	const initialPlayerState = validateInitialPlayerState(input.initialPlayerState);
	const healingAmount = validateHealingAmount(input.healingAmount);
	if (!isPlainObject(input.decks)) {
		throw new Error('Invalid deck definitions config: missing decks object');
	}

	const decks = {} as Record<DeckId, DeckDefinition>;
	for (const deckId of REQUIRED_DECK_IDS) {
		const rawDeck = input.decks[deckId];
		if (rawDeck === undefined) {
			if (deckId === 'quests') {
				decks[deckId] = {
					deck: deckId,
					cards: [],
					consumables: {
						teleport: 0,
						smallHealthPotion: 0,
						mediumHealthPotion: 0,
						largeHealthPotion: 0,
						fullHealthPotion: 0,
						extraHeart: 0,
					},
				};
				continue;
			}
			throw new Error(`Invalid deck definitions config: missing deck '${deckId}'`);
		}
		decks[deckId] = validateDeck(rawDeck, deckId);
	}

	return {
		initialPlayerState,
		healingAmount,
		'final-boss': finalBoss,
		decks,
		meta: isPlainObject(input.meta) ? input.meta : undefined,
	};
}

function buildItemDefinitions(config: DeckDefinitionsConfig): Record<string, ItemDef> {
	const items: Record<string, ItemDef> = {};

	items[config.initialPlayerState.playerWeapon.id] = config.initialPlayerState.playerWeapon;
	if (config.initialPlayerState.playerArmor && typeof config.initialPlayerState.playerArmor !== 'string') {
		items[config.initialPlayerState.playerArmor.id] = config.initialPlayerState.playerArmor;
	}

	for (const deck of Object.values(config.decks)) {
		for (const card of deck.cards) {
			if (card.kind !== 'item') continue;
			const rawCard = card as Record<string, unknown>;
			if (!items[card.id]) {
				const resolvedType = typeof rawCard.type === 'string' ? rawCard.type : undefined;
				if (resolvedType !== 'weapon' && resolvedType !== 'armor' && resolvedType !== 'item') {
					throw new Error(`Item card '${card.id}' is missing required type in deck '${deck.deck}'`);
				}
				if (typeof rawCard.name !== 'string' || rawCard.name.length === 0) {
					throw new Error(`Item card '${card.id}' is missing required name in deck '${deck.deck}'`);
				}
				if (typeof rawCard.img !== 'string' || rawCard.img.length === 0) {
					throw new Error(`Item card '${card.id}' is missing required img in deck '${deck.deck}'`);
				}
				items[card.id] = {
					id: card.id,
					name: rawCard.name,
					type: resolvedType,
					img: rawCard.img,
					effect: typeof rawCard.effect === 'string' ? rawCard.effect : null,
					heal: typeof rawCard.heal === 'number' ? rawCard.heal : null,
					attack: typeof rawCard.attack === 'number' ? rawCard.attack : null,
					attackChance:
						typeof rawCard.attackChance === 'number' ? rawCard.attackChance : null,
					defense: typeof rawCard.defense === 'number' ? rawCard.defense : null,
					defenseChance:
						typeof rawCard.defenseChance === 'number' ? rawCard.defenseChance : null,
				};
			}
		}
	}

	const healing = getHealingAmountFromConfig(config);
	for (const deck of Object.values(config.decks)) {
		for (const [consumableKey, countRaw] of Object.entries(deck.consumables) as Array<[keyof DeckConsumableCounts, number]>) {
			const count = Math.max(0, Math.floor(countRaw || 0));
			if (count <= 0) continue;
			const buildItem = CONSUMABLE_ITEM_BY_KEY[consumableKey];
			if (!buildItem) continue;
			const consumableItem = buildItem(healing);
			if (!consumableItem) continue;
			if (!items[consumableItem.id]) {
				items[consumableItem.id] = consumableItem;
			}
		}
	}

	return items;
}

function buildMonsterDefinitions(config: DeckDefinitionsConfig): Record<string, MonsterDef> {
	const monsters: Record<string, MonsterDef> = {
		[config['final-boss'].id]: config['final-boss'],
	};

	for (const deck of Object.values(config.decks)) {
		for (const card of deck.cards) {
			if (card.kind !== 'monster') continue;
			const rawCard = card as Record<string, unknown>;
			if (!monsters[card.id]) {
				if (
					typeof rawCard.name !== 'string' ||
					typeof rawCard.img !== 'string' ||
					typeof rawCard.health !== 'number' ||
					typeof rawCard.attack !== 'number' ||
					typeof rawCard.attackChance !== 'number' ||
					typeof rawCard.defense !== 'number' ||
					typeof rawCard.defenseChance !== 'number'
				) {
					throw new Error(`Monster card '${card.id}' is missing required fields`);
				}
				monsters[card.id] = {
					id: card.id,
					name: rawCard.name,
					health: rawCard.health,
					attack: rawCard.attack,
					attackChance: rawCard.attackChance,
					defense: rawCard.defense,
					defenseChance: rawCard.defenseChance,
					img: rawCard.img,
				};
			}
		}
	}

	return monsters;
}

function buildLootDeckTypesByItemId(config: DeckDefinitionsConfig): Record<string, DeckType[]> {
	const byItemId = new Map<string, Set<DeckType>>();
	for (const [deckId, deck] of Object.entries(config.decks) as Array<[DeckId, DeckDefinition]>) {
		if (!deckId.endsWith('_loot')) continue;
		const deckType = getDeckTypeFromDeckId(deckId);
		for (const card of deck.cards) {
			if (card.kind !== 'item') continue;
			const existing = byItemId.get(card.id) ?? new Set<DeckType>();
			existing.add(deckType);
			byItemId.set(card.id, existing);
		}

		const healing = getHealingAmountFromConfig(config);
		for (const [consumableKey, countRaw] of Object.entries(deck.consumables) as Array<[keyof DeckConsumableCounts, number]>) {
			const count = Math.max(0, Math.floor(countRaw || 0));
			if (count <= 0) continue;
			const buildItem = CONSUMABLE_ITEM_BY_KEY[consumableKey];
			if (!buildItem) continue;
			const item = buildItem(healing);
			if (!item) continue;
			const existing = byItemId.get(item.id) ?? new Set<DeckType>();
			existing.add(deckType);
			byItemId.set(item.id, existing);
		}
	}

	return Object.fromEntries(
		Array.from(byItemId.entries()).map(([itemId, deckTypes]) => [itemId, Array.from(deckTypes)])
	) as Record<string, DeckType[]>;
}

function getDeckTypeFromDeckId(deckId: DeckId): DeckType {
	if (deckId.startsWith('easy_')) return 'easy';
	if (deckId.startsWith('medium_')) return 'medium';
	return 'hard';
}

function toDeckId(deckType: DeckType, kind: DeckKind): DeckId {
	if (kind === 'quests') return 'quests';
	return `${deckType}_${kind}` as DeckId;
}

export function getDeckDefinitionsConfig(): DeckDefinitionsConfig | null {
	return activeDeckDefinitionsConfig;
}

export function hasDeckDefinitionsConfig(): boolean {
	return Boolean(activeDeckDefinitionsConfig);
}

export function resetDeckDefinitionsConfig(): void {
	activeDeckDefinitionsConfig = null;
	activeItemDefinitions = {};
	activeMonsterDefinitions = {};
	activeLootDeckTypesByItemId = {};
}

export function setDeckDefinitionsConfig(config: unknown): DeckDefinitionsConfig {
	activeDeckDefinitionsConfig = normalizeConfig(config);
	activeItemDefinitions = buildItemDefinitions(activeDeckDefinitionsConfig);
	activeMonsterDefinitions = buildMonsterDefinitions(activeDeckDefinitionsConfig);
	activeLootDeckTypesByItemId = buildLootDeckTypesByItemId(activeDeckDefinitionsConfig);
	return activeDeckDefinitionsConfig;
}

export function loadDeckDefinitionsConfigFromFile(filePath: string): DeckDefinitionsConfig {
	const content = fs.readFileSync(filePath, 'utf8');
	const parsed = JSON.parse(content);
	return setDeckDefinitionsConfig(parsed);
}

export function initializeDeckDefinitionsConfig(explicitPath?: string): DeckDefinitionsConfig | null {
	if (explicitPath) {
		return loadDeckDefinitionsConfigFromFile(path.resolve(explicitPath));
	}

	const defaultPath = path.resolve(process.cwd(), 'config', 'deck-definitions.json');
	if (fs.existsSync(defaultPath)) {
		return loadDeckDefinitionsConfigFromFile(defaultPath);
	}

	activeDeckDefinitionsConfig = null;
	return null;
}

export function getDeckDefinition(deckType: DeckType, kind: DeckKind): DeckDefinition | null {
	if (!activeDeckDefinitionsConfig) {
		return null;
	}
	const id = toDeckId(deckType, kind);
	return activeDeckDefinitionsConfig.decks[id] || null;
}

export function getFinalBossDefinition(): MonsterDef | null {
	if (!activeDeckDefinitionsConfig) return null;
	return activeDeckDefinitionsConfig['final-boss'];
}

export function getInitialPlayerStateDefinition(): DeckDefinitionsConfig['initialPlayerState'] | null {
	if (!activeDeckDefinitionsConfig) return null;
	return activeDeckDefinitionsConfig.initialPlayerState;
}

export function getHealingAmountDefinition(): {
	smallHealthPotion: number;
	mediumHealthPotion: number;
	largeHealthPotion: number;
} {
	if (!activeDeckDefinitionsConfig?.healingAmount) {
		return DEFAULT_HEALING_AMOUNT;
	}
	return activeDeckDefinitionsConfig.healingAmount;
}

export function getItemDefinitionById(itemId: string): ItemDef | null {
	return activeItemDefinitions[itemId] || null;
}

export function getMonsterDefinitionById(monsterId: string): MonsterDef | null {
	return activeMonsterDefinitions[monsterId] || null;
}

export function getAllItemDefinitions(): ItemDef[] {
	return Object.values(activeItemDefinitions);
}

export function getAllMonsterDefinitions(): MonsterDef[] {
	return Object.values(activeMonsterDefinitions);
}

export function getLootDeckTypesForItemId(itemId: string): DeckType[] {
	return activeLootDeckTypesByItemId[itemId] ?? [];
}

export function getQuestDefinitions(): QuestDefinition[] {
	if (!activeDeckDefinitionsConfig) {
		return [];
	}
	const quests: QuestDefinition[] = [];
	const deck = activeDeckDefinitionsConfig.decks.quests;
	if (!deck) return quests;
	for (const card of deck.cards) {
		if (card.kind !== 'quest') continue;
		const questCard = card as QuestDeckCardDef;
		quests.push({
			id: questCard.id,
			title: questCard.name,
			description: questCard.description,
			rewardHearts: questCard.rewardHearts,
			objectives: questCard.objectives,
			modifiers: questCard.modifiers,
		});
	}
	return quests;
}
