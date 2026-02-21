import {
	ArmorDeckBalanceRange,
	ItemConsumableBalanceRange,
	ItemTierDeck,
	ItemVariant,
	ItemVariantRangeModifier,
	WeaponDeckBalanceRange,
} from '../models/itemTypes.js';
import {
	MonsterConsumableBalanceRange,
	MonsterDeckBalanceRange,
	MonsterTierDeck,
	MonsterVariant,
	MonsterVarientRangeModifier,
} from '../models/monsterTypes.js';

export const DEFAULT_PLAYER_STATE = {
	playerHealth: 5,
	playerWeapon: {
		id: 'fist',
		attack: 1,
		attackChance: 0.5,
	},
};

export const DEFAULT_HEALING_AMOUNT = {
	smallHealthPotion: 3,
	mediumHealthPotion: 5,
	largeHealthPotion: 7,
};

export const DEFAULT_WEAPON_DAMAGE: Record<ItemTierDeck, WeaponDeckBalanceRange> = {
	easy: { minAttack: 4, maxAttack: 4, minChance: 0.603, maxChance: 0.603 },
	medium: { minAttack: 12, maxAttack: 12, minChance: 0.723, maxChance: 0.723 },
	hard: { minAttack: 17, maxAttack: 17, minChance: 0.823, maxChance: 0.823 },
};

export const DEFAULT_ARMOR_PROTECTION: Record<ItemTierDeck, ArmorDeckBalanceRange> = {
	easy: { minDefense: 4, maxDefense: 4, minChance: 0.603, maxChance: 0.603 },
	medium: { minDefense: 12, maxDefense: 12, minChance: 0.723, maxChance: 0.723 },
	hard: { minDefense: 17, maxDefense: 17, minChance: 0.823, maxChance: 0.823 },
};

export const DEFAULT_ITEM_TIER_BASE = {
	weapon: DEFAULT_WEAPON_DAMAGE,
	armor: DEFAULT_ARMOR_PROTECTION,
};

export const DEFAULT_ITEM_CONSUMABLES: Record<ItemTierDeck, ItemConsumableBalanceRange> = {
	easy: {
		teleport: 2,
		smallHealthPotion: 2,
		mediumHealthPotion: 2,
		largeHealthPotion: 2,
		fullHealthPotion: 2,
		extraHeart: 1,
	},
	medium: {
		teleport: 2,
		smallHealthPotion: 2,
		mediumHealthPotion: 2,
		largeHealthPotion: 2,
		fullHealthPotion: 2,
		extraHeart: 1,
	},
	hard: {
		teleport: 2,
		smallHealthPotion: 2,
		mediumHealthPotion: 2,
		largeHealthPotion: 2,
		fullHealthPotion: 2,
		extraHeart: 1,
	},
};

export const DEFAULT_ITEM_VARIANT_MODIFIERS: Record<ItemVariant, ItemVariantRangeModifier> = {
	cracked: { valueDelta: -1, chanceDelta: -0.0596 },
	normal: { valueDelta: 0, chanceDelta: 0 },
	enchanted: { valueDelta: 1, chanceDelta: 0.0596 },
};

export const DEFAULT_MONSTER_TIER_BASE: Record<MonsterTierDeck, MonsterDeckBalanceRange> = {
	easy: {
		minHealth: 5,
		maxHealth: 7,
		minAttack: 3,
		maxAttack: 5,
		minAttackChance: 0.6098,
		maxAttackChance: 0.7098,
		minDefense: 1,
		maxDefense: 3,
		minDefenseChance: 0.3098,
		maxDefenseChance: 0.4098,
	},
	medium: {
		minHealth: 12,
		maxHealth: 16,
		minAttack: 4,
		maxAttack: 6,
		minAttackChance: 0.7298,
		maxAttackChance: 0.8298,
		minDefense: 3,
		maxDefense: 5,
		minDefenseChance: 0.4498,
		maxDefenseChance: 0.5498,
	},
	hard: {
		minHealth: 23,
		maxHealth: 27,
		minAttack: 7,
		maxAttack: 9,
		minAttackChance: 0.8498,
		maxAttackChance: 0.93,
		minDefense: 5,
		maxDefense: 7,
		minDefenseChance: 0.6098,
		maxDefenseChance: 0.69,
	},
};

export const DEFAULT_MONSTER_CONSUMABLES: Record<MonsterTierDeck, MonsterConsumableBalanceRange> = {
	easy: {
		teleport: 2,
		smallHealthPotion: 2,
		mediumHealthPotion: 2,
		largeHealthPotion: 2,
		fullHealthPotion: 2,
		extraHeart: 1,
		chest: 10,
	},
	medium: {
		teleport: 2,
		smallHealthPotion: 2,
		mediumHealthPotion: 2,
		largeHealthPotion: 2,
		fullHealthPotion: 2,
		extraHeart: 1,
		chest: 10,
	},
	hard: {
		teleport: 2,
		smallHealthPotion: 2,
		mediumHealthPotion: 2,
		largeHealthPotion: 2,
		fullHealthPotion: 2,
		extraHeart: 1,
		chest: 10,
	},
};

export const DEFAULT_MONSTER_VARIANT_MODIFIERS: Record<MonsterVariant, MonsterVarientRangeModifier> = {
	weak: { healthDelta: -1, attackDelta: -1, attackChanceDelta: -0.08, defenseDelta: -1, defenseChanceDelta: -0.08 },
	normal: { healthDelta: 0, attackDelta: 0, attackChanceDelta: 0, defenseDelta: 0, defenseChanceDelta: 0 },
	strong: { healthDelta: 1, attackDelta: 1, attackChanceDelta: 0.08, defenseDelta: 1, defenseChanceDelta: 0.08 },
};
