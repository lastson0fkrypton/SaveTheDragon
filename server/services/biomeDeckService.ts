import { getItemDefs } from '../constants/items.js';
import { getMonsterDefs } from '../constants/monsters.js';
import {
	type EncounterCardKind,
	type LootCardKind,
	type MonsterVariant,
	type PlayBiome,
	getBiomeDeckConfig,
} from '../config/biomeDeckConfig.js';
import type { ItemDef, MonsterDef } from '../types.js';
import { random, randomChoice, randomInt } from '../utils/random.js';

export type EncounterCard =
	| { kind: 'monster'; biome: PlayBiome; monster: MonsterDef; monsterVariant: MonsterVariant }
	| { kind: 'item'; biome: PlayBiome; item: ItemDef }
	| { kind: 'consumable'; biome: PlayBiome; item: ItemDef }
	| { kind: 'heart'; biome: PlayBiome; hearts: number };

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

function pickMonsterVariant(biome: PlayBiome): MonsterVariant {
	const weights = getBiomeDeckConfig().BIOME_DECKS[biome].monsterVariantWeights;
	const roll = random();
	if (roll < weights.weak) return 'weak';
	if (roll < weights.weak + weights.normal) return 'normal';
	return 'strong';
}

function buildMonsterPoolByBiomeAndVariant(biome: PlayBiome, variant: MonsterVariant): MonsterDef[] {
	return getMonsterDefs().filter(monster => {
		if (!monster.biome.split(',').includes(biome)) {
			return false;
		}
		return inferMonsterVariant(monster.id) === variant;
	});
}

function buildItemPoolForBiome(biome: PlayBiome): ItemDef[] {
	return getItemDefs().filter(item => {
		if (item.noRandom) return false;
		if (item.type !== 'weapon' && item.type !== 'armor') return false;
		return Boolean(item.biome && item.biome.split(',').includes(biome));
	});
}

function buildConsumablePoolForBiome(biome: PlayBiome): ItemDef[] {
	return getItemDefs().filter(item => {
		if (item.noRandom || item.type !== 'item') return false;
		if (item.biome === 'any') return true;
		return Boolean(item.biome && item.biome.split(',').includes(biome));
	});
}

function createEncounterCard(biome: PlayBiome, kind: EncounterCardKind): EncounterCard {
	if (kind === 'monster') {
		const variant = pickMonsterVariant(biome);
		const monsters = buildMonsterPoolByBiomeAndVariant(biome, variant);
		const fallback = buildMonsterPoolByBiomeAndVariant(biome, 'normal');
		const chosen = monsters.length > 0 ? randomChoice(monsters) : randomChoice(fallback);
		return { kind: 'monster', biome, monster: chosen, monsterVariant: inferMonsterVariant(chosen.id) };
	}

	if (kind === 'item') {
		const pool = buildItemPoolForBiome(biome);
		return { kind, biome, item: randomChoice(pool) };
	}

	if (kind === 'consumable') {
		const pool = buildConsumablePoolForBiome(biome);
		return { kind, biome, item: randomChoice(pool) };
	}

	return { kind: 'heart', biome, hearts: 1 };
}

function createLootCard(biome: PlayBiome, kind: LootCardKind): LootCard {
	if (kind === 'item') {
		const pool = buildItemPoolForBiome(biome);
		return { kind, biome, item: randomChoice(pool) };
	}
	if (kind === 'consumable') {
		const pool = buildConsumablePoolForBiome(biome);
		return { kind, biome, item: randomChoice(pool) };
	}
	return { kind: 'heart', biome, hearts: 1 };
}

function buildDeckFromComposition<TKind extends string, TCard>(
	biome: PlayBiome,
	composition: Record<TKind, number>,
	factory: (biome: PlayBiome, kind: TKind) => TCard
): TCard[] {
	const built: TCard[] = [];
	for (const [kind, count] of Object.entries(composition) as Array<[TKind, number]>) {
		for (let i = 0; i < Math.max(0, count || 0); i += 1) {
			built.push(factory(biome, kind));
		}
	}
	return shuffle(built);
}

function rebuildEncounterDeck(runtime: BiomeDeckRuntime, biome: PlayBiome): void {
	const deck = runtime[biome];
	if (deck.encounterDiscard.length > 0) {
		deck.encounter = shuffle(deck.encounterDiscard);
		deck.encounterDiscard = [];
		return;
	}

	const template = getBiomeDeckConfig().BIOME_DECKS[biome];
	deck.encounter = buildDeckFromComposition(biome, template.encounterComposition, createEncounterCard);
}

function rebuildLootDeck(runtime: BiomeDeckRuntime, biome: PlayBiome): void {
	const deck = runtime[biome];
	if (deck.lootDiscard.length > 0) {
		deck.loot = shuffle(deck.lootDiscard);
		deck.lootDiscard = [];
		return;
	}

	const template = getBiomeDeckConfig().BIOME_DECKS[biome];
	deck.loot = buildDeckFromComposition(biome, template.lootComposition, createLootCard);
}

export function createBiomeDeckRuntime(): BiomeDeckRuntime {
	const biomes: PlayBiome[] = ['plains', 'forest', 'desert', 'cave', 'volcano'];
	const runtime = Object.fromEntries(
		biomes.map(biome => {
			const template = getBiomeDeckConfig().BIOME_DECKS[biome];
			const encounter = buildDeckFromComposition(biome, template.encounterComposition, createEncounterCard);
			const loot = buildDeckFromComposition(biome, template.lootComposition, createLootCard);
			return [biome, { encounter, encounterDiscard: [], loot, lootDiscard: [] }];
		})
	) as BiomeDeckRuntime;

	return runtime;
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
