import {
	type DeckConsumableCounts,
	getDeckDefinition,
} from '../config/deckDefinitionsConfig.js';
import {
	type DeckType,
	type MonsterVariant,
	type PlayBiome,
	getDeckTypeForBiome,
	getTemplateBiomeForDeckType,
} from '../config/biomeTypes.js';
import type { ItemDef, MonsterDef } from '../types.js';
import { randomInt } from '../utils/random.js';

export type EncounterCard =
	| { kind: 'monster'; biome: PlayBiome; monster: MonsterDef; monsterVariant: MonsterVariant }
	| { kind: 'item'; biome: PlayBiome; item: ItemDef }
	| { kind: 'consumable'; biome: PlayBiome; item: ItemDef }
	| { kind: 'heart'; biome: PlayBiome; hearts: number }
	| { kind: 'chest'; biome: PlayBiome; id: string };

export type LootCard =
	| { kind: 'item'; biome: PlayBiome; item: ItemDef }
	| { kind: 'consumable'; biome: PlayBiome; item: ItemDef }
	| { kind: 'heart'; biome: PlayBiome; hearts: number };

type DeckState = {
	encounter: EncounterCard[];
	encounterDiscard: EncounterCard[];
	loot: LootCard[];
	lootDiscard: LootCard[];
};

export type BiomeDeckRuntime = Record<PlayBiome, DeckState>;

type DeckPair = {
	encounter: EncounterCard[];
	loot: LootCard[];
};

const CONSUMABLE_ID_BY_KEY = {
	teleport: 'teleport',
	smallHealthPotion: 'small_potion',
	mediumHealthPotion: 'medium_potion',
	largeHealthPotion: 'large_potion',
	fullHealthPotion: 'full_potion',
} as const;

function shuffle<T>(items: T[]): T[] {
	const next = [...items];
	for (let index = next.length - 1; index > 0; index -= 1) {
		const swapIndex = randomInt(index + 1);
		const temp = next[index];
		next[index] = next[swapIndex];
		next[swapIndex] = temp;
	}
	return next;
}

function inferMonsterVariant(monsterId: string): MonsterVariant {
	if (monsterId.startsWith('weak_')) return 'weak';
	if (monsterId.startsWith('strong_')) return 'strong';
	return 'normal';
}

function resolveEncounterCardFromDefinition(
	templateBiome: PlayBiome,
	card: { kind: string; id: string; hearts?: number }
): EncounterCard {
	const rawCard = card as Record<string, unknown>;
	if (card.kind === 'monster') {
		if (
			typeof rawCard.health !== 'number' ||
			typeof rawCard.attack !== 'number' ||
			typeof rawCard.attackChance !== 'number' ||
			typeof rawCard.defense !== 'number' ||
			typeof rawCard.defenseChance !== 'number'
		) {
			throw new Error(`Encounter monster card is missing required stat fields: ${card.id}`);
		}
		const monster: MonsterDef = {
			id: card.id,
			name: typeof rawCard.name === 'string' ? rawCard.name : card.id,
			biome: typeof rawCard.biome === 'string' ? rawCard.biome : templateBiome,
			health: rawCard.health,
			attack: rawCard.attack,
			attackChance: rawCard.attackChance,
			defense: rawCard.defense,
			defenseChance: rawCard.defenseChance,
			img: typeof rawCard.img === 'string' ? rawCard.img : '',
		};
		return {
			kind: 'monster',
			biome: templateBiome,
			monster,
			monsterVariant: inferMonsterVariant(monster.id),
		};
	}

	if (card.kind === 'item') {
		const cardType = rawCard.type;
		if (cardType !== 'weapon' && cardType !== 'armor') {
			throw new Error(`Encounter item card must reference weapon/armor definition: ${card.id}`);
		}
		const item: ItemDef = {
			id: card.id,
			name: typeof rawCard.name === 'string' ? rawCard.name : card.id,
			type: cardType,
			img: typeof rawCard.img === 'string' ? rawCard.img : null,
			biome: typeof rawCard.biome === 'string' ? rawCard.biome : undefined,
			attack: typeof rawCard.attack === 'number' ? rawCard.attack : null,
			attackChance: typeof rawCard.attackChance === 'number' ? rawCard.attackChance : null,
			defense: typeof rawCard.defense === 'number' ? rawCard.defense : null,
			defenseChance: typeof rawCard.defenseChance === 'number' ? rawCard.defenseChance : null,
			heal: typeof rawCard.heal === 'number' ? rawCard.heal : null,
			effect: typeof rawCard.effect === 'string' ? rawCard.effect : null,
		};
		return {
			kind: 'item',
			biome: templateBiome,
			item,
		};
	}

	if (card.kind === 'heart') {
		return {
			kind: 'heart',
			biome: templateBiome,
			hearts: Math.max(1, Math.floor(card.hearts ?? 1)),
		};
	}

	if (card.kind === 'chest') {
		return {
			kind: 'chest',
			biome: templateBiome,
			id: card.id,
		};
	}

	throw new Error(`Unsupported encounter card kind: ${card.kind}`);
}

function resolveLootCardFromDefinition(
	templateBiome: PlayBiome,
	card: { kind: string; id: string; hearts?: number }
): LootCard {
	const rawCard = card as Record<string, unknown>;
	if (card.kind === 'item') {
		const cardType = rawCard.type;
		if (cardType !== 'weapon' && cardType !== 'armor' && cardType !== 'item') {
			throw new Error(`Loot item card is missing valid type: ${card.id}`);
		}
		const item: ItemDef = {
			id: card.id,
			name: typeof rawCard.name === 'string' ? rawCard.name : card.id,
			type: cardType,
			img: typeof rawCard.img === 'string' ? rawCard.img : null,
			biome: typeof rawCard.biome === 'string' ? rawCard.biome : undefined,
			attack: typeof rawCard.attack === 'number' ? rawCard.attack : null,
			attackChance: typeof rawCard.attackChance === 'number' ? rawCard.attackChance : null,
			defense: typeof rawCard.defense === 'number' ? rawCard.defense : null,
			defenseChance: typeof rawCard.defenseChance === 'number' ? rawCard.defenseChance : null,
			heal: typeof rawCard.heal === 'number' ? rawCard.heal : null,
			effect: typeof rawCard.effect === 'string' ? rawCard.effect : null,
		};
		if (item.type === 'item') {
			return {
				kind: 'consumable',
				biome: templateBiome,
				item,
			};
		}
		if (item.type !== 'weapon' && item.type !== 'armor') {
			throw new Error(`Loot item card must reference weapon/armor/consumable definition: ${card.id}`);
		}
		return {
			kind: 'item',
			biome: templateBiome,
			item,
		};
	}

	if (card.kind === 'heart') {
		return {
			kind: 'heart',
			biome: templateBiome,
			hearts: Math.max(1, Math.floor(card.hearts ?? 1)),
		};
	}

	throw new Error(`Unsupported loot card kind: ${card.kind}`);
}

function expandEncounterConsumables(
	templateBiome: PlayBiome,
	consumables: DeckConsumableCounts,
	itemById: Map<string, ItemDef>
): EncounterCard[] {
	const cards: EncounterCard[] = [];

	for (const [key, itemId] of Object.entries(CONSUMABLE_ID_BY_KEY) as Array<[keyof typeof CONSUMABLE_ID_BY_KEY, string]>) {
		const count = Math.max(0, Math.floor(consumables[key] || 0));
		if (count <= 0) continue;
		const item = itemById.get(itemId);
		if (!item || item.type !== 'item') {
			throw new Error(`Missing consumable item definition for '${String(key)}' -> '${itemId}'`);
		}
		for (let index = 0; index < count; index += 1) {
			cards.push({ kind: 'consumable', biome: templateBiome, item });
		}
	}

	const extraHeartCount = Math.max(0, Math.floor(consumables.extraHeart || 0));
	for (let index = 0; index < extraHeartCount; index += 1) {
		cards.push({ kind: 'heart', biome: templateBiome, hearts: 1 });
	}

	return cards;
}

function expandLootConsumables(
	templateBiome: PlayBiome,
	consumables: DeckConsumableCounts,
	itemById: Map<string, ItemDef>
): LootCard[] {
	const cards: LootCard[] = [];

	for (const [key, itemId] of Object.entries(CONSUMABLE_ID_BY_KEY) as Array<[keyof typeof CONSUMABLE_ID_BY_KEY, string]>) {
		const count = Math.max(0, Math.floor(consumables[key] || 0));
		if (count <= 0) continue;
		const item = itemById.get(itemId);
		if (!item || item.type !== 'item') {
			throw new Error(`Missing consumable item definition for '${String(key)}' -> '${itemId}'`);
		}
		for (let index = 0; index < count; index += 1) {
			cards.push({ kind: 'consumable', biome: templateBiome, item });
		}
	}

	const extraHeartCount = Math.max(0, Math.floor(consumables.extraHeart || 0));
	for (let index = 0; index < extraHeartCount; index += 1) {
		cards.push({ kind: 'heart', biome: templateBiome, hearts: 1 });
	}

	return cards;
}

function buildDecksFromDefinitions(deckType: DeckType): DeckPair {
	const encounterDefinition = getDeckDefinition(deckType, 'encounter');
	const lootDefinition = getDeckDefinition(deckType, 'loot');
	if (!encounterDefinition || !lootDefinition) {
		throw new Error(`Missing required explicit deck definitions for deck type '${deckType}'`);
	}

	const templateBiome = getTemplateBiomeForDeckType(deckType);
	const itemById = new Map<string, ItemDef>();
	for (const card of [...encounterDefinition.cards, ...lootDefinition.cards]) {
		if (card.kind !== 'item') continue;
		const rawCard = card as Record<string, unknown>;
		const cardType = rawCard.type;
		if (cardType !== 'weapon' && cardType !== 'armor' && cardType !== 'item') continue;
		itemById.set(card.id, {
			id: card.id,
			name: typeof rawCard.name === 'string' ? rawCard.name : card.id,
			type: cardType,
			img: typeof rawCard.img === 'string' ? rawCard.img : null,
			biome: typeof rawCard.biome === 'string' ? rawCard.biome : undefined,
			attack: typeof rawCard.attack === 'number' ? rawCard.attack : null,
			attackChance: typeof rawCard.attackChance === 'number' ? rawCard.attackChance : null,
			defense: typeof rawCard.defense === 'number' ? rawCard.defense : null,
			defenseChance: typeof rawCard.defenseChance === 'number' ? rawCard.defenseChance : null,
			heal: typeof rawCard.heal === 'number' ? rawCard.heal : null,
			effect: typeof rawCard.effect === 'string' ? rawCard.effect : null,
		});
	}

	const encounterCards = encounterDefinition.cards.map(card =>
		resolveEncounterCardFromDefinition(templateBiome, card as { kind: string; id: string; hearts?: number })
	);
	const encounterConsumables = expandEncounterConsumables(templateBiome, encounterDefinition.consumables, itemById);

	const lootCards = lootDefinition.cards.map(card =>
		resolveLootCardFromDefinition(templateBiome, card as { kind: string; id: string; hearts?: number })
	);
	const lootConsumables = expandLootConsumables(templateBiome, lootDefinition.consumables, itemById);

	return {
		encounter: shuffle([...encounterCards, ...encounterConsumables]),
		loot: shuffle([...lootCards, ...lootConsumables]),
	};
}

function rebuildEncounterDeck(runtime: BiomeDeckRuntime, biome: PlayBiome): void {
	const deck = runtime[biome];
	if (deck.encounterDiscard.length > 0) {
		deck.encounter = shuffle(deck.encounterDiscard);
		deck.encounterDiscard = [];
		return;
	}

	const deckType = getDeckTypeForBiome(biome);
	const explicit = buildDecksFromDefinitions(deckType);
	deck.encounter = explicit.encounter;
}

function rebuildLootDeck(runtime: BiomeDeckRuntime, biome: PlayBiome): void {
	const deck = runtime[biome];
	if (deck.lootDiscard.length > 0) {
		deck.loot = shuffle(deck.lootDiscard);
		deck.lootDiscard = [];
		return;
	}

	const deckType = getDeckTypeForBiome(biome);
	const explicit = buildDecksFromDefinitions(deckType);
	deck.loot = explicit.loot;
}

export function createBiomeDeckRuntime(): BiomeDeckRuntime {
	const stateByDeckType = {
		forest: (() => {
			const explicit = buildDecksFromDefinitions('forest');
			return { encounter: explicit.encounter, encounterDiscard: [], loot: explicit.loot, lootDiscard: [] };
		})(),
		desert: (() => {
			const explicit = buildDecksFromDefinitions('desert');
			return { encounter: explicit.encounter, encounterDiscard: [], loot: explicit.loot, lootDiscard: [] };
		})(),
		volcano: (() => {
			const explicit = buildDecksFromDefinitions('volcano');
			return { encounter: explicit.encounter, encounterDiscard: [], loot: explicit.loot, lootDiscard: [] };
		})(),
	};

	return {
		plains: stateByDeckType.forest,
		forest: stateByDeckType.forest,
		desert: stateByDeckType.desert,
		cave: stateByDeckType.volcano,
		volcano: stateByDeckType.volcano,
	};
}

export function drawEncounterCard(runtime: BiomeDeckRuntime, biome: PlayBiome): EncounterCard {
	if (!runtime[biome] || runtime[biome].encounter.length === 0) {
		rebuildEncounterDeck(runtime, biome);
	}
	const card = runtime[biome].encounter.pop();
	if (!card) {
		rebuildEncounterDeck(runtime, biome);
		return drawEncounterCard(runtime, biome);
	}
	runtime[biome].encounterDiscard.push(card);
	return card;
}

export function drawLootCard(runtime: BiomeDeckRuntime, biome: PlayBiome): LootCard {
	if (!runtime[biome] || runtime[biome].loot.length === 0) {
		rebuildLootDeck(runtime, biome);
	}
	const card = runtime[biome].loot.pop();
	if (!card) {
		rebuildLootDeck(runtime, biome);
		return drawLootCard(runtime, biome);
	}
	runtime[biome].lootDiscard.push(card);
	return card;
}
