import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createSeededRandom } from './random.js';
import { runApiSimulation, type AggregateResult, type SimOptions } from './deckBalanceSimulator.js';

type BalanceDeck = 'easy' | 'medium' | 'hard';

type Genome = {
	DEFAULT_HEALING_AMOUNT: {
		smallHealthPotion: number;
		mediumHealthPotion: number;
		largeHealthPotion: number;
	};
	DEFAULT_BOSS_STATE: {
		health: number;
		attack: number;
		attackChance: number;
		defense: number;
		defenseChance: number;
	};
	DEFAULT_WEAPON_DAMAGE: Record<BalanceDeck, { minAttack: number; maxAttack: number; minChance: number; maxChance: number }>;
	DEFAULT_ARMOR_PROTECTION: Record<BalanceDeck, { minDefense: number; maxDefense: number; minChance: number; maxChance: number }>;
	DEFAULT_ITEM_CONSUMABLES: Record<
		BalanceDeck,
		{
			teleport: number;
			smallHealthPotion: number;
			mediumHealthPotion: number;
			largeHealthPotion: number;
			fullHealthPotion: number;
			extraHeart: number;
		}
	>;
	DEFAULT_ITEM_VARIANT_MODIFIERS: {
		cracked: { valueDelta: number; chanceDelta: number };
		normal: { valueDelta: number; chanceDelta: number };
		enchanted: { valueDelta: number; chanceDelta: number };
	};
	DEFAULT_MONSTER_TIER_BASE: Record<
		BalanceDeck,
		{
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
		}
	>;
	DEFAULT_MONSTER_CONSUMABLES: Record<
		BalanceDeck,
		{
			teleport: number;
			smallHealthPotion: number;
			mediumHealthPotion: number;
			largeHealthPotion: number;
			fullHealthPotion: number;
			extraHeart: number;
			chest: number;
		}
	>;
	DEFAULT_MONSTER_VARIANT_MODIFIERS: {
		weak: { healthDelta: number; attackDelta: number; attackChanceDelta: number; defenseDelta: number; defenseChanceDelta: number };
		normal: { healthDelta: number; attackDelta: number; attackChanceDelta: number; defenseDelta: number; defenseChanceDelta: number };
		strong: { healthDelta: number; attackDelta: number; attackChanceDelta: number; defenseDelta: number; defenseChanceDelta: number };
	};
	QUEST_DECK_MODIFIERS: Record<
		BalanceDeck,
		{
			numberOfQuests: number;
			numberOfObjectives: number;
			rewardHearts: number;
			questTypes: {
				traveller?: number;
				battler?: number;
			};
		}
	>;
};

type BalanceJsonConfig = Genome;

type Candidate = {
	genome: Genome;
	fitness: number;
	aggregate: AggregateResult;
};

type WorkerSimulationResult = {
	aggregate: AggregateResult;
};

type Args = {
	seed: string;
	games: number;
	maxTurns: number;
	gridSizeX: number;
	gridSizeY: number;
	generations: number;
	population: number;
	elite: number;
	candidateParallelism: number;
	targetSuccessRate: number;
	targetMinTurns: number;
	targetAvgTurns: number;
	targetMaxTurns: number;
	successPenaltyWeight: number;
	minTurnsPenaltyWeight: number;
	turnsPenaltyWeight: number;
	maxTurnsPenaltyWeight: number;
	artifactDir: string;
	runName: string;
	baseDeckDefinitionsPath: string;
};

function parseArgs(argv: string[]): Record<string, string> {
	const output: Record<string, string> = {};
	for (const arg of argv) {
		if (!arg.startsWith('--')) continue;
		const [key, ...rest] = arg.slice(2).split('=');
		output[key] = rest.length > 0 ? rest.join('=') : 'true';
	}
	return output;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function parseRuntimeArgs(raw: Record<string, string>): Args {
	const seed = raw.seed || `deck-autobalance-${Date.now()}`;
	const runName = raw.runName || seed;
	const artifactDir = raw.artifactDir || 'simulation-output';

	return {
		seed,
		games: Math.max(10, Number(raw.games || 40)),
		maxTurns: Math.max(30, Number(raw.maxTurns || 120)),
		gridSizeX: Math.max(10, Number(raw.gridSizeX || 20)),
		gridSizeY: Math.max(10, Number(raw.gridSizeY || 20)),
		generations: Math.max(1, Number(raw.generations || 4)),
		population: Math.max(4, Number(raw.population || 10)),
		elite: Math.max(1, Number(raw.elite || 3)),
		candidateParallelism: Math.max(1, Number(raw.candidateParallelism || 2)),
		targetSuccessRate: clamp(Number(raw.targetSuccessRate || raw.targetCompletionRate || 1.0), 0, 1),
		targetMinTurns: Math.max(1, Number(raw.targetMinTurns || 30)),
		targetAvgTurns: Math.max(20, Number(raw.targetAvgTurns || 95)),
		targetMaxTurns: Math.max(20, Number(raw.targetMaxTurns || 100)),
		successPenaltyWeight: Math.max(0, Number(raw.successPenaltyWeight || 1.8)),
		minTurnsPenaltyWeight: Math.max(0, Number(raw.minTurnsPenaltyWeight || 0.8)),
		turnsPenaltyWeight: Math.max(0, Number(raw.turnsPenaltyWeight || 0.35)),
		maxTurnsPenaltyWeight: Math.max(0, Number(raw.maxTurnsPenaltyWeight || 1.1)),
		artifactDir,
		runName,
		baseDeckDefinitionsPath:
			raw.baseDeckDefinitionsPath || raw.baseDeckPath || path.resolve(process.cwd(), '..', 'server', 'config', 'deck-definitions.json'),
	};
}

function toCount(value: number): number {
	return Math.max(0, Math.round(value));
}

function clampChance(value: number): number {
	return clamp(Number(value.toFixed(4)), 0.05, 0.95);
}

type GenomeBound = {
	path: string;
	min: number;
	max: number;
	span: number;
	integer?: boolean;
	chance?: boolean;
};

type RangeDeltaConstraint = {
	minPath: string;
	maxPath: string;
	minDelta: number;
	options: { min: number; max: number; integer?: boolean; chance?: boolean };
};

type AscendingConstraint = {
	paths: [string, string, string];
	options: { min: number; max: number; minStep: number; integer?: boolean; chance?: boolean };
};

type SignedConstraint = {
	path: string;
	direction: 'negative' | 'zero' | 'positive';
	options: { min: number; max: number; integer?: boolean; chance?: boolean };
};

const BASE_GENOME: Genome = {
	DEFAULT_HEALING_AMOUNT: {
		smallHealthPotion: 3,
		mediumHealthPotion: 5,
		largeHealthPotion: 7,
	},
	DEFAULT_BOSS_STATE: {
		health: 120,
		attack: 8,
		attackChance: 0.85,
		defense: 5,
		defenseChance: 0.65,
	},
	DEFAULT_WEAPON_DAMAGE: {
		easy: { minAttack: 1, maxAttack: 4, minChance: 0.5, maxChance: 0.6 },
		medium: { minAttack: 9, maxAttack: 12, minChance: 0.65, maxChance: 0.75 },
		hard: { minAttack: 14, maxAttack: 17, minChance: 0.75, maxChance: 0.85 },
	},
	DEFAULT_ARMOR_PROTECTION: {
		easy: { minDefense: 4, maxDefense: 4, minChance: 0.603, maxChance: 0.603 },
		medium: { minDefense: 12, maxDefense: 12, minChance: 0.723, maxChance: 0.723 },
		hard: { minDefense: 17, maxDefense: 17, minChance: 0.823, maxChance: 0.823 },
	},
	DEFAULT_ITEM_CONSUMABLES: {
		easy: { teleport: 2, smallHealthPotion: 2, mediumHealthPotion: 2, largeHealthPotion: 2, fullHealthPotion: 2, extraHeart: 1 },
		medium: { teleport: 2, smallHealthPotion: 2, mediumHealthPotion: 2, largeHealthPotion: 2, fullHealthPotion: 2, extraHeart: 1 },
		hard: { teleport: 2, smallHealthPotion: 2, mediumHealthPotion: 2, largeHealthPotion: 2, fullHealthPotion: 2, extraHeart: 1 },
	},
	DEFAULT_ITEM_VARIANT_MODIFIERS: {
		cracked: { valueDelta: -1, chanceDelta: -0.0596 },
		normal: { valueDelta: 0, chanceDelta: 0 },
		enchanted: { valueDelta: 1, chanceDelta: 0.0596 },
	},
	DEFAULT_MONSTER_TIER_BASE: {
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
	},
	DEFAULT_MONSTER_CONSUMABLES: {
		easy: { teleport: 2, smallHealthPotion: 2, mediumHealthPotion: 2, largeHealthPotion: 2, fullHealthPotion: 2, extraHeart: 1, chest: 10 },
		medium: { teleport: 2, smallHealthPotion: 2, mediumHealthPotion: 2, largeHealthPotion: 2, fullHealthPotion: 2, extraHeart: 1, chest: 10 },
		hard: { teleport: 2, smallHealthPotion: 2, mediumHealthPotion: 2, largeHealthPotion: 2, fullHealthPotion: 2, extraHeart: 1, chest: 10 },
	},
	DEFAULT_MONSTER_VARIANT_MODIFIERS: {
		weak: { healthDelta: -1, attackDelta: -1, attackChanceDelta: -0.08, defenseDelta: -1, defenseChanceDelta: -0.08 },
		normal: { healthDelta: 0, attackDelta: 0, attackChanceDelta: 0, defenseDelta: 0, defenseChanceDelta: 0 },
		strong: { healthDelta: 1, attackDelta: 1, attackChanceDelta: 0.08, defenseDelta: 1, defenseChanceDelta: 0.08 },
	},
	QUEST_DECK_MODIFIERS: {
		easy: { numberOfQuests: 6, numberOfObjectives: 2, rewardHearts: 1, questTypes: { traveller: 2, battler: 4 } },
		medium: { numberOfQuests: 6, numberOfObjectives: 2, rewardHearts: 2, questTypes: { traveller: 1, battler: 5 } },
		hard: { numberOfQuests: 6, numberOfObjectives: 3, rewardHearts: 3, questTypes: { traveller: 0, battler: 6 } },
	},
};

const GENOME_BOUNDS: GenomeBound[] = [
	{ path: 'DEFAULT_HEALING_AMOUNT.smallHealthPotion', min: 1, max: 20, span: 2, integer: true },
	{ path: 'DEFAULT_HEALING_AMOUNT.mediumHealthPotion', min: 1, max: 30, span: 2, integer: true },
	{ path: 'DEFAULT_HEALING_AMOUNT.largeHealthPotion', min: 1, max: 40, span: 3, integer: true },
	{ path: 'DEFAULT_BOSS_STATE.health', min: 20, max: 400, span: 20, integer: true },
	{ path: 'DEFAULT_BOSS_STATE.attack', min: 1, max: 80, span: 4, integer: true },
	{ path: 'DEFAULT_BOSS_STATE.attackChance', min: 0.05, max: 0.95, span: 0.05, chance: true },
	{ path: 'DEFAULT_BOSS_STATE.defense', min: 0, max: 80, span: 4, integer: true },
	{ path: 'DEFAULT_BOSS_STATE.defenseChance', min: 0.05, max: 0.95, span: 0.05, chance: true },
	...(['easy', 'medium', 'hard'] as const).flatMap(deck => [
		{ path: `DEFAULT_WEAPON_DAMAGE.${deck}.minAttack`, min: 1, max: 60, span: 3, integer: true },
		{ path: `DEFAULT_WEAPON_DAMAGE.${deck}.maxAttack`, min: 1, max: 70, span: 4, integer: true },
		{ path: `DEFAULT_WEAPON_DAMAGE.${deck}.minChance`, min: 0.05, max: 0.95, span: 0.05, chance: true },
		{ path: `DEFAULT_WEAPON_DAMAGE.${deck}.maxChance`, min: 0.05, max: 0.95, span: 0.05, chance: true },
		{ path: `DEFAULT_ARMOR_PROTECTION.${deck}.minDefense`, min: 0, max: 60, span: 3, integer: true },
		{ path: `DEFAULT_ARMOR_PROTECTION.${deck}.maxDefense`, min: 0, max: 70, span: 4, integer: true },
		{ path: `DEFAULT_ARMOR_PROTECTION.${deck}.minChance`, min: 0.05, max: 0.95, span: 0.05, chance: true },
		{ path: `DEFAULT_ARMOR_PROTECTION.${deck}.maxChance`, min: 0.05, max: 0.95, span: 0.05, chance: true },
		{ path: `DEFAULT_ITEM_CONSUMABLES.${deck}.teleport`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_ITEM_CONSUMABLES.${deck}.smallHealthPotion`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_ITEM_CONSUMABLES.${deck}.mediumHealthPotion`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_ITEM_CONSUMABLES.${deck}.largeHealthPotion`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_ITEM_CONSUMABLES.${deck}.fullHealthPotion`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_ITEM_CONSUMABLES.${deck}.extraHeart`, min: 0, max: 12, span: 1, integer: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.minHealth`, min: 1, max: 120, span: 6, integer: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxHealth`, min: 1, max: 140, span: 8, integer: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.minAttack`, min: 1, max: 80, span: 4, integer: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxAttack`, min: 1, max: 90, span: 5, integer: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.minAttackChance`, min: 0.05, max: 0.95, span: 0.05, chance: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxAttackChance`, min: 0.05, max: 0.95, span: 0.05, chance: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.minDefense`, min: 0, max: 80, span: 4, integer: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxDefense`, min: 0, max: 90, span: 5, integer: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.minDefenseChance`, min: 0.05, max: 0.95, span: 0.05, chance: true },
		{ path: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxDefenseChance`, min: 0.05, max: 0.95, span: 0.05, chance: true },
		{ path: `DEFAULT_MONSTER_CONSUMABLES.${deck}.teleport`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_MONSTER_CONSUMABLES.${deck}.smallHealthPotion`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_MONSTER_CONSUMABLES.${deck}.mediumHealthPotion`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_MONSTER_CONSUMABLES.${deck}.largeHealthPotion`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_MONSTER_CONSUMABLES.${deck}.fullHealthPotion`, min: 0, max: 20, span: 2, integer: true },
		{ path: `DEFAULT_MONSTER_CONSUMABLES.${deck}.extraHeart`, min: 0, max: 12, span: 1, integer: true },
		{ path: `DEFAULT_MONSTER_CONSUMABLES.${deck}.chest`, min: 0, max: 40, span: 3, integer: true },
	]),
	...(['cracked', 'normal', 'enchanted'] as const).flatMap(variant => [
		{ path: `DEFAULT_ITEM_VARIANT_MODIFIERS.${variant}.valueDelta`, min: -12, max: 12, span: 1, integer: true },
		{ path: `DEFAULT_ITEM_VARIANT_MODIFIERS.${variant}.chanceDelta`, min: -0.5, max: 0.5, span: 0.03 },
	]),
	...(['weak', 'normal', 'strong'] as const).flatMap(variant => [
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.${variant}.healthDelta`, min: -20, max: 20, span: 1, integer: true },
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.${variant}.attackDelta`, min: -20, max: 20, span: 1, integer: true },
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.${variant}.attackChanceDelta`, min: -0.5, max: 0.5, span: 0.03 },
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.${variant}.defenseDelta`, min: -20, max: 20, span: 1, integer: true },
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.${variant}.defenseChanceDelta`, min: -0.5, max: 0.5, span: 0.03 },
	]),
	...(['easy', 'medium', 'hard'] as const).flatMap(deck => [
		{ path: `QUEST_DECK_MODIFIERS.${deck}.numberOfQuests`, min: 0, max: 20, span: 2, integer: true },
		{ path: `QUEST_DECK_MODIFIERS.${deck}.numberOfObjectives`, min: 1, max: 5, span: 1, integer: true },
		{ path: `QUEST_DECK_MODIFIERS.${deck}.rewardHearts`, min: 0, max: 10, span: 1, integer: true },
	]),
];

const RANGE_DELTA_CONSTRAINTS: RangeDeltaConstraint[] = (['easy', 'medium', 'hard'] as const).flatMap(deck => [
	{
		minPath: `DEFAULT_WEAPON_DAMAGE.${deck}.minAttack`,
		maxPath: `DEFAULT_WEAPON_DAMAGE.${deck}.maxAttack`,
		minDelta: 4,
		options: { min: 1, max: 70, integer: true },
	},
	{
		minPath: `DEFAULT_WEAPON_DAMAGE.${deck}.minChance`,
		maxPath: `DEFAULT_WEAPON_DAMAGE.${deck}.maxChance`,
		minDelta: 0.2,
		options: { min: 0.05, max: 0.95, chance: true },
	},
	{
		minPath: `DEFAULT_ARMOR_PROTECTION.${deck}.minDefense`,
		maxPath: `DEFAULT_ARMOR_PROTECTION.${deck}.maxDefense`,
		minDelta: 4,
		options: { min: 0, max: 70, integer: true },
	},
	{
		minPath: `DEFAULT_ARMOR_PROTECTION.${deck}.minChance`,
		maxPath: `DEFAULT_ARMOR_PROTECTION.${deck}.maxChance`,
		minDelta: 0.2,
		options: { min: 0.05, max: 0.95, chance: true },
	},
	{
		minPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.minHealth`,
		maxPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxHealth`,
		minDelta: 4,
		options: { min: 1, max: 140, integer: true },
	},
	{
		minPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.minAttack`,
		maxPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxAttack`,
		minDelta: 4,
		options: { min: 1, max: 90, integer: true },
	},
	{
		minPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.minDefense`,
		maxPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxDefense`,
		minDelta: 4,
		options: { min: 0, max: 90, integer: true },
	},
	{
		minPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.minAttackChance`,
		maxPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxAttackChance`,
		minDelta: 0.2,
		options: { min: 0.05, max: 0.95, chance: true },
	},
	{
		minPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.minDefenseChance`,
		maxPath: `DEFAULT_MONSTER_TIER_BASE.${deck}.maxDefenseChance`,
		minDelta: 0.2,
		options: { min: 0.05, max: 0.95, chance: true },
	},
]);

const ASCENDING_CONSTRAINTS: AscendingConstraint[] = [
	{
		paths: [
			'DEFAULT_HEALING_AMOUNT.smallHealthPotion',
			'DEFAULT_HEALING_AMOUNT.mediumHealthPotion',
			'DEFAULT_HEALING_AMOUNT.largeHealthPotion',
		],
		options: { min: 1, max: 40, minStep: 1, integer: true },
	},
	{
		paths: [
			'DEFAULT_WEAPON_DAMAGE.easy.minAttack',
			'DEFAULT_WEAPON_DAMAGE.medium.minAttack',
			'DEFAULT_WEAPON_DAMAGE.hard.minAttack',
		],
		options: { min: 1, max: 60, minStep: 1, integer: true },
	},
	{
		paths: [
			'DEFAULT_WEAPON_DAMAGE.easy.maxAttack',
			'DEFAULT_WEAPON_DAMAGE.medium.maxAttack',
			'DEFAULT_WEAPON_DAMAGE.hard.maxAttack',
		],
		options: { min: 1, max: 70, minStep: 1, integer: true },
	},
	{
		paths: [
			'DEFAULT_ARMOR_PROTECTION.easy.minDefense',
			'DEFAULT_ARMOR_PROTECTION.medium.minDefense',
			'DEFAULT_ARMOR_PROTECTION.hard.minDefense',
		],
		options: { min: 0, max: 60, minStep: 1, integer: true },
	},
	{
		paths: [
			'DEFAULT_ARMOR_PROTECTION.easy.maxDefense',
			'DEFAULT_ARMOR_PROTECTION.medium.maxDefense',
			'DEFAULT_ARMOR_PROTECTION.hard.maxDefense',
		],
		options: { min: 0, max: 70, minStep: 1, integer: true },
	},
	...(['minHealth', 'maxHealth', 'minAttack', 'maxAttack', 'minDefense', 'maxDefense'] as const).map(field => ({
		paths: [
			`DEFAULT_MONSTER_TIER_BASE.easy.${field}`,
			`DEFAULT_MONSTER_TIER_BASE.medium.${field}`,
			`DEFAULT_MONSTER_TIER_BASE.hard.${field}`,
		] as [string, string, string],
		options: {
			min: field.includes('Health') ? 1 : 0,
			max: field.includes('Health') ? 140 : 90,
			minStep: 1,
			integer: true,
		},
	})),
	...(['minAttackChance', 'maxAttackChance', 'minDefenseChance', 'maxDefenseChance'] as const).map(field => ({
		paths: [
			`DEFAULT_MONSTER_TIER_BASE.easy.${field}`,
			`DEFAULT_MONSTER_TIER_BASE.medium.${field}`,
			`DEFAULT_MONSTER_TIER_BASE.hard.${field}`,
		] as [string, string, string],
		options: { min: 0.05, max: 0.95, minStep: 0.0001, chance: true },
	})),
];

const SIGNED_CONSTRAINTS: SignedConstraint[] = [
	{ path: 'DEFAULT_ITEM_VARIANT_MODIFIERS.cracked.valueDelta', direction: 'negative', options: { min: -12, max: 12, integer: true } },
	{ path: 'DEFAULT_ITEM_VARIANT_MODIFIERS.cracked.chanceDelta', direction: 'negative', options: { min: -0.5, max: 0.5, chance: true } },
	{ path: 'DEFAULT_ITEM_VARIANT_MODIFIERS.normal.valueDelta', direction: 'zero', options: { min: -12, max: 12, integer: true } },
	{ path: 'DEFAULT_ITEM_VARIANT_MODIFIERS.normal.chanceDelta', direction: 'zero', options: { min: -0.5, max: 0.5, chance: true } },
	{ path: 'DEFAULT_ITEM_VARIANT_MODIFIERS.enchanted.valueDelta', direction: 'positive', options: { min: -12, max: 12, integer: true } },
	{ path: 'DEFAULT_ITEM_VARIANT_MODIFIERS.enchanted.chanceDelta', direction: 'positive', options: { min: -0.5, max: 0.5, chance: true } },
	...(['healthDelta', 'attackDelta', 'defenseDelta'] as const).flatMap(field => [
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.weak.${field}`, direction: 'negative' as const, options: { min: -20, max: 20, integer: true } },
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.normal.${field}`, direction: 'zero' as const, options: { min: -20, max: 20, integer: true } },
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.strong.${field}`, direction: 'positive' as const, options: { min: -20, max: 20, integer: true } },
	]),
	...(['attackChanceDelta', 'defenseChanceDelta'] as const).flatMap(field => [
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.weak.${field}`, direction: 'negative' as const, options: { min: -0.5, max: 0.5, chance: true } },
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.normal.${field}`, direction: 'zero' as const, options: { min: -0.5, max: 0.5, chance: true } },
		{ path: `DEFAULT_MONSTER_VARIANT_MODIFIERS.strong.${field}`, direction: 'positive' as const, options: { min: -0.5, max: 0.5, chance: true } },
	]),
];

function getNumericByPath(target: Record<string, unknown>, dotPath: string): number {
	const value = dotPath.split('.').reduce<unknown>((current, key) => {
		if (!current || typeof current !== 'object') return undefined;
		return (current as Record<string, unknown>)[key];
	}, target);
	if (typeof value !== 'number') {
		throw new Error(`Expected numeric value at genome path '${dotPath}'`);
	}
	return value;
}

function setNumericByPath(target: Record<string, unknown>, dotPath: string, value: number): void {
	const parts = dotPath.split('.');
	let cursor: Record<string, unknown> = target;
	for (let index = 0; index < parts.length - 1; index += 1) {
		const key = parts[index];
		const next = cursor[key];
		if (!next || typeof next !== 'object' || Array.isArray(next)) {
			cursor[key] = {};
		}
		cursor = cursor[key] as Record<string, unknown>;
	}
	cursor[parts[parts.length - 1]] = value;
}

function normalizeRangePair(target: Record<string, unknown>, minPath: string, maxPath: string): void {
	const minValue = getNumericByPath(target, minPath);
	const maxValue = getNumericByPath(target, maxPath);
	if (minValue <= maxValue) return;
	setNumericByPath(target, minPath, maxValue);
	setNumericByPath(target, maxPath, minValue);
}

function enforceRangeDelta(
	target: Record<string, unknown>,
	minPath: string,
	maxPath: string,
	minDelta: number,
	options: { min: number; max: number; integer?: boolean; chance?: boolean }
): void {
	let minValue = clamp(getNumericByPath(target, minPath), options.min, options.max);
	let maxValue = clamp(getNumericByPath(target, maxPath), options.min, options.max);

	if (minValue > maxValue) {
		[minValue, maxValue] = [maxValue, minValue];
	}

	if (maxValue - minValue < minDelta) {
		const raisedMax = minValue + minDelta;
		if (raisedMax <= options.max) {
			maxValue = raisedMax;
		} else {
			const loweredMin = maxValue - minDelta;
			if (loweredMin >= options.min) {
				minValue = loweredMin;
			} else {
				minValue = options.min;
				maxValue = options.max;
			}
		}
	}

	minValue = clamp(minValue, options.min, options.max);
	maxValue = clamp(maxValue, options.min, options.max);

	if (options.integer) {
		minValue = Math.round(minValue);
		maxValue = Math.round(maxValue);
	}
	if (options.chance) {
		minValue = clampChance(minValue);
		maxValue = clampChance(maxValue);
	}

	if (maxValue - minValue < minDelta) {
		if (options.chance) {
			maxValue = clampChance(Math.min(options.max, minValue + minDelta));
			if (maxValue - minValue < minDelta) {
				minValue = clampChance(Math.max(options.min, maxValue - minDelta));
			}
		} else {
			maxValue = Math.min(options.max, minValue + minDelta);
			if (maxValue - minValue < minDelta) {
				minValue = Math.max(options.min, maxValue - minDelta);
			}
		}
	}

	setNumericByPath(target, minPath, minValue);
	setNumericByPath(target, maxPath, maxValue);
}

function enforceStrictAscending(
	target: Record<string, unknown>,
	paths: [string, string, string],
	options: { min: number; max: number; minStep: number; integer?: boolean; chance?: boolean }
): void {
	let values = paths.map(path => clamp(getNumericByPath(target, path), options.min, options.max));

	for (let index = 1; index < values.length; index += 1) {
		values[index] = Math.max(values[index], values[index - 1] + options.minStep);
	}

	if (values[values.length - 1] > options.max) {
		values[values.length - 1] = options.max;
		for (let index = values.length - 2; index >= 0; index -= 1) {
			values[index] = Math.min(values[index], values[index + 1] - options.minStep);
		}
	}

	if (values[0] < options.min) {
		values[0] = options.min;
		for (let index = 1; index < values.length; index += 1) {
			values[index] = Math.max(values[index], values[index - 1] + options.minStep);
		}
	}

	for (let index = 0; index < values.length; index += 1) {
		let next = clamp(values[index], options.min, options.max);
		if (options.integer) {
			next = Math.round(next);
		}
		if (options.chance) {
			next = clampChance(next);
		}
		setNumericByPath(target, paths[index], next);
	}
}

function enforceSignedValue(
	target: Record<string, unknown>,
	path: string,
	direction: 'negative' | 'zero' | 'positive',
	options: { min: number; max: number; integer?: boolean; chance?: boolean }
): void {
	let value = clamp(getNumericByPath(target, path), options.min, options.max);

	if (direction === 'zero') {
		value = 0;
	} else if (direction === 'negative') {
		const threshold = options.integer ? -1 : -0.0001;
		value = Math.min(value, threshold);
	} else {
		const threshold = options.integer ? 1 : 0.0001;
		value = Math.max(value, threshold);
	}

	value = clamp(value, options.min, options.max);
	if (options.integer) {
		value = Math.round(value);
	}
	if (options.chance) {
		value = clamp(Number(value.toFixed(4)), options.min, options.max);
	}

	setNumericByPath(target, path, value);
}

function applyRangeDeltaConstraints(target: Record<string, unknown>, constraints: RangeDeltaConstraint[]): void {
	for (const constraint of constraints) {
		enforceRangeDelta(
			target,
			constraint.minPath,
			constraint.maxPath,
			constraint.minDelta,
			constraint.options
		);
	}
}

function applyAscendingConstraints(target: Record<string, unknown>, constraints: AscendingConstraint[]): void {
	for (const constraint of constraints) {
		enforceStrictAscending(target, constraint.paths, constraint.options);
	}
}

function applySignedConstraints(target: Record<string, unknown>, constraints: SignedConstraint[]): void {
	for (const constraint of constraints) {
		enforceSignedValue(target, constraint.path, constraint.direction, constraint.options);
	}
}

function createBalanceConfigFromGenome(genome: Genome): BalanceJsonConfig {
	const normalized = structuredClone(genome) as Record<string, unknown>;

	for (const bound of GENOME_BOUNDS) {
		const current = getNumericByPath(normalized, bound.path);
		let next = clamp(current, bound.min, bound.max);
		if (bound.integer) {
			next = Math.round(next);
		}
		if (bound.chance) {
			next = clampChance(next);
		}
		setNumericByPath(normalized, bound.path, next);
	}

	for (const deck of ['easy', 'medium', 'hard'] as const) {
		normalizeRangePair(normalized, `DEFAULT_WEAPON_DAMAGE.${deck}.minAttack`, `DEFAULT_WEAPON_DAMAGE.${deck}.maxAttack`);
		normalizeRangePair(normalized, `DEFAULT_WEAPON_DAMAGE.${deck}.minChance`, `DEFAULT_WEAPON_DAMAGE.${deck}.maxChance`);
		normalizeRangePair(normalized, `DEFAULT_ARMOR_PROTECTION.${deck}.minDefense`, `DEFAULT_ARMOR_PROTECTION.${deck}.maxDefense`);
		normalizeRangePair(normalized, `DEFAULT_ARMOR_PROTECTION.${deck}.minChance`, `DEFAULT_ARMOR_PROTECTION.${deck}.maxChance`);
		normalizeRangePair(normalized, `DEFAULT_MONSTER_TIER_BASE.${deck}.minHealth`, `DEFAULT_MONSTER_TIER_BASE.${deck}.maxHealth`);
		normalizeRangePair(normalized, `DEFAULT_MONSTER_TIER_BASE.${deck}.minAttack`, `DEFAULT_MONSTER_TIER_BASE.${deck}.maxAttack`);
		normalizeRangePair(normalized, `DEFAULT_MONSTER_TIER_BASE.${deck}.minAttackChance`, `DEFAULT_MONSTER_TIER_BASE.${deck}.maxAttackChance`);
		normalizeRangePair(normalized, `DEFAULT_MONSTER_TIER_BASE.${deck}.minDefense`, `DEFAULT_MONSTER_TIER_BASE.${deck}.maxDefense`);
		normalizeRangePair(normalized, `DEFAULT_MONSTER_TIER_BASE.${deck}.minDefenseChance`, `DEFAULT_MONSTER_TIER_BASE.${deck}.maxDefenseChance`);
	}

	applyRangeDeltaConstraints(normalized, RANGE_DELTA_CONSTRAINTS);

	applyAscendingConstraints(normalized, ASCENDING_CONSTRAINTS);


	applyRangeDeltaConstraints(normalized, RANGE_DELTA_CONSTRAINTS);

	applySignedConstraints(normalized, SIGNED_CONSTRAINTS);

	return normalized as BalanceJsonConfig;
}

function buildRandomGenome(rand: () => number): Genome {
	const out = structuredClone(BASE_GENOME) as Record<string, unknown>;
	for (const bound of GENOME_BOUNDS) {
		const baseValue = getNumericByPath(out, bound.path);
		let next = clamp(baseValue + (rand() * 2 - 1) * bound.span, bound.min, bound.max);
		if (bound.integer) {
			next = Math.round(next);
		}
		if (bound.chance) {
			next = clampChance(next);
		}
		setNumericByPath(out, bound.path, next);
	}
	return createBalanceConfigFromGenome(out as Genome);
}

function crossover(a: Genome, b: Genome, rand: () => number): Genome {
	const out = structuredClone(a) as Record<string, unknown>;
	for (const bound of GENOME_BOUNDS) {
		const left = getNumericByPath(a as Record<string, unknown>, bound.path);
		const right = getNumericByPath(b as Record<string, unknown>, bound.path);
		const mixed = left * (1 - rand()) + right * rand();
		setNumericByPath(out, bound.path, mixed);
	}
	return createBalanceConfigFromGenome(out as Genome);
}

function mutate(genome: Genome, mutationRate: number, rand: () => number): Genome {
	const out = structuredClone(genome) as Record<string, unknown>;
	for (const bound of GENOME_BOUNDS) {
		if (rand() > mutationRate) continue;
		const current = getNumericByPath(out, bound.path);
		const next = clamp(current + (rand() * 2 - 1) * bound.span, bound.min, bound.max);
		setNumericByPath(out, bound.path, next);
	}
	return createBalanceConfigFromGenome(out as Genome);
}

function getTsxBinPath(): string {
	return 'tsx';
}

function getDeckGeneratorScriptPath(): string {
	return path.resolve(process.cwd(), '..', 'deck-generator', 'src', 'generateDeckDefinitions.ts');
}

async function generateDeckDefinitionsFromBalance(outPath: string, balanceConfigPath?: string): Promise<void> {
	const scriptPath = getDeckGeneratorScriptPath();
	const tsxLoader = getTsxBinPath();
	const args = [
		'--import',
		tsxLoader,
		scriptPath,
		`--out=${outPath}`,
	];
	if (balanceConfigPath) {
		args.push(`--balance=${balanceConfigPath}`);
	}

	await new Promise<void>((resolve, reject) => {
		const child = spawn(process.execPath, args, {
			cwd: process.cwd(),
			env: { ...process.env },
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';
		child.stdout.on('data', chunk => {
			stdout += chunk.toString();
		});
		child.stderr.on('data', chunk => {
			stderr += chunk.toString();
		});

		child.on('error', error => {
			reject(error);
		});

		child.on('close', code => {
			if (code !== 0) {
				reject(
					new Error(
						`deck generator exited with code ${code}. ${stderr.trim() || stdout.trim() || 'no generator output'}`
					)
				);
				return;
			}
			resolve();
		});
	});
}

async function runSimulationWorker(simOptions: SimOptions): Promise<WorkerSimulationResult> {
	const workerScript = path.resolve(process.cwd(), 'src', 'candidateSimulationWorker.ts');
	const tsxLoader = getTsxBinPath();
	const args = [
		'--import',
		tsxLoader,
		workerScript,
		`--games=${simOptions.games}`,
		`--maxTurns=${simOptions.maxTurns}`,
		`--seed=${simOptions.seed}`,
		`--gridSizeX=${simOptions.gridSizeX}`,
		`--gridSizeY=${simOptions.gridSizeY}`,
		`--playerName=${simOptions.playerName}`,
		`--deckDefinitionsConfigPath=${simOptions.deckDefinitionsConfigPath || ''}`,
		`--balanceConfigPath=${simOptions.balanceConfigPath || ''}`,
	];

	return await new Promise<WorkerSimulationResult>((resolve, reject) => {
		const child = spawn(process.execPath, args, {
			cwd: process.cwd(),
			env: { ...process.env },
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';
		child.stdout.on('data', chunk => {
			stdout += chunk.toString();
		});
		child.stderr.on('data', chunk => {
			stderr += chunk.toString();
		});

		child.on('error', error => {
			reject(error);
		});

		child.on('close', code => {
			if (code !== 0) {
				reject(
					new Error(
						`candidate worker exited with code ${code}. ${stderr.trim() || stdout.trim() || 'no worker output'}`
					)
				);
				return;
			}

			const lines = stdout
				.split(/\r?\n/)
				.map(line => line.trim())
				.filter(Boolean);
			const jsonLine = lines[lines.length - 1];
			if (!jsonLine) {
				reject(new Error(`candidate worker produced no stdout. stderr=${stderr.trim() || 'none'}`));
				return;
			}

			try {
				const parsed = JSON.parse(jsonLine) as WorkerSimulationResult;
				resolve(parsed);
			} catch (error) {
				reject(
					new Error(
						`candidate worker output was not valid JSON. output=${jsonLine.slice(0, 300)} error=${error instanceof Error ? error.message : String(error)}`
					)
				);
			}
		});
	});
}

async function evaluateCandidate(
	genome: Genome,
	args: Args,
	seedSuffix: string
): Promise<Candidate> {
	const _tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dragon-ga-'));

	try {
		const balanceConfig = createBalanceConfigFromGenome(genome);
		const balanceConfigPath = path.join(_tempDir, 'balance.json');
		await fs.writeFile(balanceConfigPath, JSON.stringify(balanceConfig, null, 2), 'utf8');

		const simOptions: SimOptions = {
			games: args.games,
			maxTurns: args.maxTurns,
			seed: `${args.seed}-${seedSuffix}`,
			gridSizeX: args.gridSizeX,
			gridSizeY: args.gridSizeY,
			playerName: 'AutoBalanceBot',
			deckDefinitionsConfigPath: args.baseDeckDefinitionsPath,
			balanceConfigPath,
		};

		const output = await runSimulationWorker(simOptions);

		const successPenalty = Math.abs(output.aggregate.successRate - args.targetSuccessRate);
		const minTurnsPenalty =
			output.aggregate.minTurnsPlayed < args.targetMinTurns
				? (args.targetMinTurns - output.aggregate.minTurnsPlayed) / args.targetMinTurns
				: 0;
		const turnsPenalty = Math.abs(output.aggregate.avgTurnsPlayed - args.targetAvgTurns) / args.targetAvgTurns;
		const maxTurnsPenalty =
			output.aggregate.maxTurnsPlayed > args.targetMaxTurns
				? (output.aggregate.maxTurnsPlayed - args.targetMaxTurns) / args.targetMaxTurns
				: 0;
		const fitness = Number(
			(
				1 -
				(
					successPenalty * args.successPenaltyWeight +
					minTurnsPenalty * args.minTurnsPenaltyWeight +
					turnsPenalty * args.turnsPenaltyWeight +
					maxTurnsPenalty * args.maxTurnsPenaltyWeight
				)
			).toFixed(6)
		);

		return {
			genome,
			fitness,
			aggregate: output.aggregate,
		};
	} finally {
		await fs.rm(_tempDir, { recursive: true, force: true });
	}
}

async function evaluateCandidateWithRetry(
	genome: Genome,
	args: Args,
	seedSuffix: string
): Promise<Candidate> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await evaluateCandidate(genome, args, `${seedSuffix}-a${attempt}`);
		} catch (error) {
			lastError = error;
			if (attempt < 3) {
				await new Promise(resolve => setTimeout(resolve, attempt * 250));
			}
		}
	}
	throw lastError;
}

async function evaluatePopulation(
	population: Genome[],
	args: Args,
	generation: number
): Promise<Candidate[]> {
	const results: Candidate[] = new Array(population.length);
	let nextIndex = 0;
	const workerCount = Math.min(args.candidateParallelism, population.length);
	let activeWorkers = 0;

	const workers = Array.from({ length: Math.min(workerCount, population.length) }, async (_, workerSlot) => {
		while (true) {
			const index = nextIndex;
			nextIndex += 1;
			if (index >= population.length) break;

			activeWorkers += 1;
			console.error(
				`[autobalance] g${generation + 1} dispatch c${index + 1}/${population.length} slot=${workerSlot + 1}/${workerCount} active=${activeWorkers}`
			);
			try {
				const candidate = await evaluateCandidateWithRetry(
					population[index],
					args,
					`g${generation + 1}-c${index + 1}`
				);
				results[index] = candidate;
				console.error(
					`[autobalance] g${generation + 1} c${index + 1}/${population.length} fitness=${candidate.fitness.toFixed(4)} success=${(candidate.aggregate.successRate * 100).toFixed(1)}% avgTurns=${candidate.aggregate.avgTurnsPlayed.toFixed(1)}`
				);
			} catch (error) {
				const fallback = await evaluateCandidateWithRetry(
					buildRandomGenome(createSeededRandom(`${args.seed}-fallback-${generation + 1}-${index + 1}`)),
					args,
					`g${generation + 1}-fallback-c${index + 1}`
				);
				results[index] = fallback;
				console.error(
					`[autobalance] g${generation + 1} c${index + 1}/${population.length} failed; substituted fallback. error=${error instanceof Error ? error.message : String(error)}`
				);
			} finally {
				activeWorkers = Math.max(0, activeWorkers - 1);
				console.error(
					`[autobalance] g${generation + 1} complete c${index + 1}/${population.length} slot=${workerSlot + 1}/${workerCount} active=${activeWorkers}`
				);
			}
		}
	});

	await Promise.all(workers);
	return results;
}

async function main() {
	const args = parseRuntimeArgs(parseArgs(process.argv.slice(2)));
	const startedAt = Date.now();
	const rand = createSeededRandom(args.seed);
	const mutationRate = 0.3;

	console.error(
		`[autobalance] seed=${args.seed} generations=${args.generations} population=${args.population} games=${args.games} maxTurns=${args.maxTurns}`
	);

	const runFolder = `${args.runName}`
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-_]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '') || `autobalance-${Date.now()}`;
	const artifactDir = path.resolve(process.cwd(), args.artifactDir, runFolder);
	await fs.mkdir(artifactDir, { recursive: true });

	let population = Array.from({ length: args.population }, () => buildRandomGenome(rand));
	let best: Candidate | null = null;
	const history: Array<{
		generation: number;
		bestFitness: number;
		successRate: number;
		minTurnsPlayed: number;
		avgTurnsPlayed: number;
		maxTurnsPlayed: number;
		bossDefeatRate: number;
	}> = [];

	for (let generation = 0; generation < args.generations; generation += 1) {
		console.error(`[autobalance] generation ${generation + 1}/${args.generations} started`);
		const evaluated = await evaluatePopulation(population, args, generation);
		evaluated.sort((left, right) => right.fitness - left.fitness);
		const generationBest = evaluated[0];
		if (!best || generationBest.fitness > best.fitness) {
			best = generationBest;
		}
		history.push({
			generation: generation + 1,
			bestFitness: generationBest.fitness,
			successRate: generationBest.aggregate.successRate,
			minTurnsPlayed: generationBest.aggregate.minTurnsPlayed,
			avgTurnsPlayed: generationBest.aggregate.avgTurnsPlayed,
			maxTurnsPlayed: generationBest.aggregate.maxTurnsPlayed,
			bossDefeatRate: generationBest.aggregate.successRate,
		});

		console.error(
			`[autobalance] generation ${generation + 1} best fitness=${generationBest.fitness.toFixed(4)} success=${(generationBest.aggregate.successRate * 100).toFixed(1)}% min/avg/max=${generationBest.aggregate.minTurnsPlayed}/${generationBest.aggregate.avgTurnsPlayed.toFixed(1)}/${generationBest.aggregate.maxTurnsPlayed}`
		);

		const next: Genome[] = evaluated.slice(0, Math.min(args.elite, evaluated.length)).map(entry => entry.genome);
		while (next.length < args.population) {
			const parentA = evaluated[Math.floor(rand() * Math.min(6, evaluated.length))].genome;
			const parentB = evaluated[Math.floor(rand() * Math.min(6, evaluated.length))].genome;
			next.push(mutate(crossover(parentA, parentB, rand), mutationRate, rand));
		}
		population = next;
	}

	if (!best) {
		throw new Error('No candidate evaluated');
	}

	const bestBalancePath = path.join(artifactDir, 'best-balance.json');
	await fs.writeFile(bestBalancePath, JSON.stringify(createBalanceConfigFromGenome(best.genome), null, 2), 'utf8');

	const baselineDeckDefinitionsPath = path.join(artifactDir, 'baseline-deck-definitions.json');
	await fs.copyFile(args.baseDeckDefinitionsPath, baselineDeckDefinitionsPath);

	const bestDeckDefinitionsPath = path.join(artifactDir, 'best-deck-definitions.json');
	await generateDeckDefinitionsFromBalance(bestDeckDefinitionsPath, bestBalancePath);

	const baselineSummary = await runApiSimulation(
		{
			games: args.games,
			maxTurns: args.maxTurns,
			seed: `${args.seed}-baseline`,
			gridSizeX: args.gridSizeX,
			gridSizeY: args.gridSizeY,
			playerName: 'AutoBalanceBot',
			deckDefinitionsConfigPath: args.baseDeckDefinitionsPath,
		},
		{ writeArtifacts: true, artifactRoot: path.join(args.artifactDir, runFolder), runName: 'baseline-report' }
	);

	const bestSummary = await runApiSimulation(
		{
			games: Math.max(args.games, 50),
			maxTurns: args.maxTurns,
			seed: `${args.seed}-best`,
			gridSizeX: args.gridSizeX,
			gridSizeY: args.gridSizeY,
			playerName: 'AutoBalanceBot',
			deckDefinitionsConfigPath: bestDeckDefinitionsPath,
			balanceConfigPath: bestBalancePath,
		},
		{ writeArtifacts: true, artifactRoot: path.join(args.artifactDir, runFolder), runName: 'best-report' }
	);

	const output = {
		meta: {
			seed: args.seed,
			generations: args.generations,
			population: args.population,
			candidateParallelism: args.candidateParallelism,
			gamesPerCandidate: args.games,
			durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
			targets: {
				successRate: args.targetSuccessRate,
				minTurns: args.targetMinTurns,
				avgTurns: args.targetAvgTurns,
				maxTurns: args.targetMaxTurns,
				successPenaltyWeight: args.successPenaltyWeight,
				minTurnsPenaltyWeight: args.minTurnsPenaltyWeight,
				turnsPenaltyWeight: args.turnsPenaltyWeight,
				maxTurnsPenaltyWeight: args.maxTurnsPenaltyWeight,
			},
		},
		history,
		bestCandidate: {
			fitness: best.fitness,
			bossDefeatRate: best.aggregate.successRate,
			aggregate: best.aggregate,
			genome: best.genome,
			baselineDeckDefinitionsPath,
			bestDeckDefinitionsPath,
			bestBalancePath,
		},
		baselineAggregate: baselineSummary.aggregate,
		bestDetailedAggregate: bestSummary.aggregate,
	};

	const resultPath = path.join(artifactDir, 'autobalance-result.json');
	await fs.writeFile(resultPath, JSON.stringify(output, null, 2), 'utf8');
	console.error(`[autobalance] complete. result: ${resultPath}`);
	console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
	console.error('Auto-balance failed:', error);
	process.exitCode = 1;
});
