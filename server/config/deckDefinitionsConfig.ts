import fs from 'node:fs';
import path from 'node:path';
import type { DeckType } from './biomeTypes.js';
import type { ItemDef, MonsterDef } from '../types.js';

export type DeckKind = 'encounter' | 'loot';
export type DeckId =
	| 'forest_encounter'
	| 'forest_loot'
	| 'desert_encounter'
	| 'desert_loot'
	| 'volcano_encounter'
	| 'volcano_loot';

export type EncounterDeckCardDef =
	| { kind: 'monster'; id: string }
	| { kind: 'item'; id: string }
	| { kind: 'heart'; id: string; hearts?: number }
	| { kind: 'chest'; id: string };

export type LootDeckCardDef =
	| { kind: 'item'; id: string }
	| { kind: 'heart'; id: string; hearts?: number };

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
	cards: Array<EncounterDeckCardDef | LootDeckCardDef>;
	consumables: DeckConsumableCounts;
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
	'forest_encounter',
	'forest_loot',
	'desert_encounter',
	'desert_loot',
	'volcano_encounter',
	'volcano_loot',
];

let activeDeckDefinitionsConfig: DeckDefinitionsConfig | null = null;
let activeItemDefinitions: Record<string, ItemDef> = {};
let activeMonsterDefinitions: Record<string, MonsterDef> = {};

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
		biome: typeof rawItem.biome === 'string' ? rawItem.biome : undefined,
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
	if (typeof rawMonster.biome !== 'string' || rawMonster.biome.length === 0) {
		throw new Error(`Invalid monster definition '${label}': missing biome`);
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
		biome: rawMonster.biome,
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

function validateCard(rawCard: unknown, deckId: DeckId, index: number): EncounterDeckCardDef | LootDeckCardDef {
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

	if (kind === 'heart') {
		if (hearts !== undefined && (typeof hearts !== 'number' || !Number.isFinite(hearts) || hearts <= 0)) {
			throw new Error(`Invalid card at ${deckId}[${index}]: heart cards require hearts > 0 when provided`);
		}
		const normalizedHearts = typeof hearts === 'number' ? Math.floor(hearts) : 1;
		return { ...rawCard, kind: 'heart', id, hearts: normalizedHearts } as EncounterDeckCardDef | LootDeckCardDef;
	}

	if (kind === 'monster' || kind === 'item' || kind === 'chest') {
		return { ...rawCard, kind, id } as EncounterDeckCardDef | LootDeckCardDef;
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

	const cards = rawDeck.cards.map((card, index) => validateCard(card, deckId, index));
	const consumables = validateConsumables(rawDeck.consumables, deckId);
	return {
		deck: deckId,
		cards,
		consumables,
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
					biome: typeof rawCard.biome === 'string' ? rawCard.biome : undefined,
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
					typeof rawCard.biome !== 'string' ||
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
					biome: rawCard.biome,
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

function toDeckId(deckType: DeckType, kind: DeckKind): DeckId {
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
}

export function setDeckDefinitionsConfig(config: unknown): DeckDefinitionsConfig {
	activeDeckDefinitionsConfig = normalizeConfig(config);
	activeItemDefinitions = buildItemDefinitions(activeDeckDefinitionsConfig);
	activeMonsterDefinitions = buildMonsterDefinitions(activeDeckDefinitionsConfig);
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
		return {
			smallHealthPotion: 3,
			mediumHealthPotion: 5,
			largeHealthPotion: 7,
		};
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
