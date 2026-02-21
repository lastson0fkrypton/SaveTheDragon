import type { ItemConsumableBalanceRange, ItemTierDeck } from './itemTypes.js';

export type MonsterTierDeck = ItemTierDeck;
export type MonsterVariant = 'weak' | 'normal' | 'strong';

export interface MonsterDef {
	id: string;
	name: string;
	biome: string;
	health: number;
	attack: number;
	attackChance: number;
	defense: number;
	defenseChance: number;
	img: string;
}

export type MonsterDeckBalanceRange = {
	minHealth: number;
	maxHealth: number;
	minAttack: number;
	maxAttack: number;
	minAttackChance: number;
	maxAttackChance: number;
	minDefense: number;
	maxDefense: number;
	minDefenseChance: number;
	maxDefenseChance: number;
};

export type MonsterConsumableBalanceRange = ItemConsumableBalanceRange & {
	chest?: number;
};

export type MonsterVarientRangeModifier = {
	healthDelta: number;
	attackDelta: number;
	attackChanceDelta: number;
	defenseDelta: number;
	defenseChanceDelta: number;
};

export type MonsterCatalogSourceEntry = {
	id: string;
	name: string;
	biome: string;
	img: string;
};

export type MonsterCatalogBase = Pick<MonsterCatalogSourceEntry, 'id' | 'name' | 'biome' | 'img'>;
