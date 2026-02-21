export type ItemType = 'weapon' | 'armor' | 'item';

export interface ItemDef {
	id: string;
	name: string;
	type: ItemType;
	biome?: string;
	attack?: number | null;
	attackChance?: number | null;
	defense?: number | null;
	defenseChance?: number | null;
	heal?: number | null;
	effect?: string | null;
	img?: string | null;
}

export type ItemTierDeck = 'easy' | 'medium' | 'hard';
export type ItemVariant = 'cracked' | 'normal' | 'enchanted';

export type WeaponDeckBalanceRange = {
	minAttack: number;
	maxAttack: number;
	minChance: number;
	maxChance: number;
};

export type ArmorDeckBalanceRange = {
	minDefense: number;
	maxDefense: number;
	minChance: number;
	maxChance: number;
};

export type ItemConsumableBalanceRange = {
	teleport: number;
	smallHealthPotion: number;
	mediumHealthPotion: number;
	largeHealthPotion: number;
	fullHealthPotion: number;
	extraHeart: number;
};

export type ItemVariantRangeModifier = { valueDelta: number; chanceDelta: number };

export type ItemCatalogSourceEntry = {
	id: string;
	name: string;
	type: ItemType;
	img: string;
};

export type ConsumableCatalogSourceEntry = {
	id: string;
	name: string;
	effect: string;
	img: string;
};
