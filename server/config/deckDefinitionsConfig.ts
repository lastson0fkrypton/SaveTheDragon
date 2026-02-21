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
};

export type DeckDefinition = {
	deck: DeckId;
	cards: Array<EncounterDeckCardDef | LootDeckCardDef>;
	consumables: DeckConsumableCounts;
};

export type DeckDefinitionsConfig = {
	initialPlayerState?: {
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
	startingItems: {
		weapon: ItemDef;
		armor: ItemDef | '';
	};
	itemDefinitions: Record<string, ItemDef>;
	monsterDefinitions: Record<string, { id: string; name: string; biome: string; img?: string | null }>;
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

function validateMonsterCatalogEntry(
	rawMonster: unknown,
	label: string
): { id: string; name: string; biome: string; img?: string | null } {
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
	return {
		id: rawMonster.id,
		name: rawMonster.name,
		biome: rawMonster.biome,
		img: typeof rawMonster.img === 'string' ? rawMonster.img : null,
	};
}

function validateStartingItems(rawStartingItems: unknown): DeckDefinitionsConfig['startingItems'] {
	if (!isPlainObject(rawStartingItems)) {
		throw new Error('Invalid deck definitions config: missing startingItems object');
	}

	const weapon = validateItemDef(rawStartingItems.weapon, 'startingItems.weapon');
	if (weapon.type !== 'weapon') {
		throw new Error('Invalid deck definitions config: startingItems.weapon must have type=weapon');
	}

	let armor: ItemDef | '' = '';
	if (rawStartingItems.armor === '') {
		armor = '';
	} else if (rawStartingItems.armor !== undefined && rawStartingItems.armor !== null) {
		const parsedArmor = validateItemDef(rawStartingItems.armor, 'startingItems.armor');
		if (parsedArmor.type !== 'armor') {
			throw new Error('Invalid deck definitions config: startingItems.armor must have type=armor or be empty string');
		}
		armor = parsedArmor;
	}

	return { weapon, armor };
}

function validateInitialPlayerState(rawInitialPlayerState: unknown): DeckDefinitionsConfig['initialPlayerState'] | undefined {
	if (!isPlainObject(rawInitialPlayerState)) {
		return undefined;
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

function validateItemDefinitions(rawItemDefinitions: unknown): Record<string, ItemDef> {
	const result: Record<string, ItemDef> = {};
	if (Array.isArray(rawItemDefinitions)) {
		for (let index = 0; index < rawItemDefinitions.length; index += 1) {
			const rawItem = rawItemDefinitions[index];
			const normalizedRawItem =
				isPlainObject(rawItem) &&
				rawItem.type === undefined &&
				typeof rawItem.effect === 'string'
					? { ...rawItem, type: 'item' }
					: rawItem;
			const item = validateItemDef(normalizedRawItem, `itemDefinitions[${index}]`);
			result[item.id] = item;
		}
		return result;
	}

	if (!isPlainObject(rawItemDefinitions)) {
		throw new Error('Invalid deck definitions config: missing itemDefinitions object/array');
	}

	for (const [id, rawItem] of Object.entries(rawItemDefinitions)) {
		result[id] = validateItemDef(rawItem, `itemDefinitions.${id}`);
	}

	return result;
}

function validateMonsterDefinitions(
	rawMonsterDefinitions: unknown
): Record<string, { id: string; name: string; biome: string; img?: string | null }> {
	const result: Record<string, { id: string; name: string; biome: string; img?: string | null }> = {};
	if (rawMonsterDefinitions === undefined || rawMonsterDefinitions === null) {
		return result;
	}
	if (Array.isArray(rawMonsterDefinitions)) {
		for (let index = 0; index < rawMonsterDefinitions.length; index += 1) {
			const monster = validateMonsterCatalogEntry(rawMonsterDefinitions[index], `monsterDefinitions[${index}]`);
			result[monster.id] = monster;
		}
		return result;
	}
	if (!isPlainObject(rawMonsterDefinitions)) {
		throw new Error('Invalid deck definitions config: monsterDefinitions must be object/array when provided');
	}
	for (const [id, rawMonster] of Object.entries(rawMonsterDefinitions)) {
		result[id] = validateMonsterCatalogEntry(rawMonster, `monsterDefinitions.${id}`);
	}
	return result;
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

	const finalBoss = validateMonsterDef(input['final-boss'], 'final-boss');
	const startingItems = validateStartingItems(input.startingItems);
	const initialPlayerState = validateInitialPlayerState(input.initialPlayerState);
	const healingAmount = validateHealingAmount(input.healingAmount);
	const itemDefinitions = validateItemDefinitions(input.itemDefinitions);
	const monsterDefinitions = validateMonsterDefinitions(input.monsterDefinitions);
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
		startingItems,
		itemDefinitions,
		monsterDefinitions,
		decks,
		meta: isPlainObject(input.meta) ? input.meta : undefined,
	};
}

function buildItemDefinitions(config: DeckDefinitionsConfig): Record<string, ItemDef> {
	const items: Record<string, ItemDef> = {};

	for (const item of Object.values(config.itemDefinitions)) {
		items[item.id] = item;
	}

	items[config.startingItems.weapon.id] = config.startingItems.weapon;
	if (config.startingItems.armor && typeof config.startingItems.armor !== 'string') {
		items[config.startingItems.armor.id] = config.startingItems.armor;
	}

	for (const deck of Object.values(config.decks)) {
		for (const card of deck.cards) {
			if (card.kind !== 'item') continue;
			const rawCard = card as Record<string, unknown>;
			if (!items[card.id]) {
				const baseId =
					typeof rawCard.baseItemId === 'string'
						? rawCard.baseItemId
						: typeof rawCard.baseId === 'string'
							? rawCard.baseId
							: card.id;
				const base = items[baseId] || items[card.id];
				const inferredType = base?.type || (typeof rawCard.type === 'string' ? rawCard.type : undefined);
				if (inferredType !== 'weapon' && inferredType !== 'armor' && inferredType !== 'item') {
					throw new Error(`Cannot infer item type for card '${card.id}' in deck '${deck.deck}'`);
				}
				items[card.id] = {
					id: card.id,
					name: typeof rawCard.name === 'string' ? rawCard.name : base?.name || card.id,
					type: inferredType,
					biome: base?.biome,
					img: base?.img ?? null,
					effect: base?.effect ?? null,
					heal: typeof rawCard.heal === 'number' ? rawCard.heal : (base?.heal ?? null),
					attack: typeof rawCard.attack === 'number' ? rawCard.attack : (base?.attack ?? null),
					attackChance:
						typeof rawCard.attackChance === 'number' ? rawCard.attackChance : (base?.attackChance ?? null),
					defense: typeof rawCard.defense === 'number' ? rawCard.defense : (base?.defense ?? null),
					defenseChance:
						typeof rawCard.defenseChance === 'number' ? rawCard.defenseChance : (base?.defenseChance ?? null),
				};
			}
			if (!items[card.id].effect && items[card.id].type === 'item') {
				const fallbackBase =
					items[
						typeof rawCard.baseItemId === 'string'
							? rawCard.baseItemId
							: typeof rawCard.baseId === 'string'
								? rawCard.baseId
								: card.id
					];
				items[card.id].effect = fallbackBase?.effect ?? items[card.id].effect;
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
				const canUseLegacyCardDirectly =
					typeof rawCard.biome === 'string' &&
					typeof rawCard.health === 'number' &&
					typeof rawCard.attack === 'number' &&
					typeof rawCard.attackChance === 'number' &&
					typeof rawCard.defense === 'number' &&
					typeof rawCard.defenseChance === 'number';

				if (canUseLegacyCardDirectly) {
					monsters[card.id] = validateMonsterDef(rawCard, `decks.${deck.deck}.cards.${card.id}`);
					continue;
				}

				const baseId =
					typeof rawCard.baseMonsterId === 'string'
						? rawCard.baseMonsterId
						: typeof rawCard.baseId === 'string'
							? rawCard.baseId
							: card.id.startsWith('weak_') || card.id.startsWith('strong_')
								? card.id.replace(/^weak_|^strong_/, '')
								: card.id;
				const base = config.monsterDefinitions[baseId] || config.monsterDefinitions[card.id];
				if (!base) {
					throw new Error(`Missing monsterDefinitions base entry for '${baseId}' (card '${card.id}')`);
				}
				if (
					typeof rawCard.health !== 'number' ||
					typeof rawCard.attack !== 'number' ||
					typeof rawCard.attackChance !== 'number' ||
					typeof rawCard.defense !== 'number' ||
					typeof rawCard.defenseChance !== 'number'
				) {
					throw new Error(`Monster card '${card.id}' is missing required stat fields`);
				}
				monsters[card.id] = {
					id: card.id,
					name: typeof rawCard.name === 'string' ? rawCard.name : base.name,
					biome: typeof rawCard.biome === 'string' ? rawCard.biome : base.biome,
					health: rawCard.health,
					attack: rawCard.attack,
					attackChance: rawCard.attackChance,
					defense: rawCard.defense,
					defenseChance: rawCard.defenseChance,
					img: typeof rawCard.img === 'string' ? rawCard.img : (base.img || ''),
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

export function getStartingItemsDefinition(): DeckDefinitionsConfig['startingItems'] | null {
	if (!activeDeckDefinitionsConfig) return null;
	return activeDeckDefinitionsConfig.startingItems;
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
