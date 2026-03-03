import type { Quest } from '../models/questTypes.js';

export const quests: Quest[] = [
	// -----------------
	// Easy (+1 heart)
	// -----------------
	{
		name: 'Forest Patrol',
		description: 'Kill 2 monsters in forest.',
		rewardHearts: 1,
		objectives: [{ kind: 'battle', kills: 2, biome: 'forest', variant: null }],
		modifiers: {},
	},
	{
		name: 'Scout the Wilds',
		description: 'Enter 3 different biomes.',
		rewardHearts: 1,
		objectives: [{ kind: 'visit', biome: 'any', count: 3 }],
		modifiers: {},
		// RECOMMENDATION: If 'any' is selected for biome, it should enforce different biomes. Add distinctBiomes?: boolean.
	},
	{
		name: 'Town Courier',
		description: 'Visit 2 different towns.',
		rewardHearts: 1,
		objectives: [{ kind: 'visit_town', count: 2 }],
		modifiers: {},
		// RECOMMENDATION: if visit_town count > 1 it should enforce visiting different towns.
	},
	{
		name: 'Clean Sweep',
		description: 'Defeat 2 weak monsters.',
		rewardHearts: 1,
		objectives: [{ kind: 'battle', kills: 2, variant: 'weak', biome: null }],
		modifiers: {},
	},
	{
		name: 'Potion Discipline',
		description: 'Use 1 consumable and win your next battle.',
		rewardHearts: 1,
		objectives: [{ kind: 'battle', kills: 1, biome: null, variant: null }],
		modifiers: {
			requiresConsumableThenWin: true,
		},
	},
	{
		name: 'No Rest for the Brave',
		description: 'Win 2 battles without returning to town.',
		rewardHearts: 1,
		objectives: [{ kind: 'battle', kills: 2, biome: null, variant: null }],
		modifiers: {
			withoutEnteringTown: true,
		},
	},
	{
		name: 'First Blood',
		description: 'Defeat 1 regular monster.',
		rewardHearts: 1,
		objectives: [{ kind: 'battle', kills: 1, variant: 'regular', biome: null }],
		modifiers: {},
	},
	{
		name: 'Monster Mix',
		description: 'Defeat 1 weak and 1 regular monster.',
		rewardHearts: 1,
		objectives: [
			{ kind: 'battle', kills: 1, variant: 'weak', biome: null },
			{ kind: 'battle', kills: 1, variant: 'regular', biome: null },
		],
		modifiers: {},
	},
	// -----------------
	// Medium (+2 hearts)
	// -----------------
	{
		name: 'Desert Exterminator',
		description: 'Kill 3 monsters in desert.',
		rewardHearts: 2,
		objectives: [{ kind: 'battle', kills: 3, biome: 'desert', variant: null }],
		modifiers: {},
	},
	{
		name: 'Dual Biome Hunter',
		description: 'Defeat 2 monsters in forest and 2 in desert.',
		rewardHearts: 2,
		objectives: [
			{ kind: 'battle', kills: 2, biome: 'forest', variant: null },
			{ kind: 'battle', kills: 2, biome: 'desert', variant: null },
		],
		modifiers: {},
	},
	{
		name: 'Cave Survivor',
		description: 'Win 2 battles in cave without using consumables.',
		rewardHearts: 2,
		objectives: [{ kind: 'battle', kills: 2, biome: 'cave', variant: null }],
		modifiers: {
			withoutUsingConsumables: true,
		},
	},
	{
		name: 'Careful Explorer',
		description: 'Visit forest, plains, and desert without dying.',
		rewardHearts: 2,
		objectives: [
			{ kind: 'visit', biome: 'forest', count: 1 },
			{ kind: 'visit', biome: 'plains', count: 1 },
			{ kind: 'visit', biome: 'desert', count: 1 },
		],
		modifiers: {
			withoutDying: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'Prepared Warrior',
		description: 'Use a consumable, then win 2 battles without dying.',
		rewardHearts: 2,
		objectives: [{ kind: 'battle', kills: 2, biome: null, variant: null }],
		modifiers: {
			requiresConsumableThenWin: true,
			withoutDying: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'Stronghold Breaker',
		description: 'Defeat 2 strong monsters.',
		rewardHearts: 2,
		objectives: [{ kind: 'battle', kills: 2, biome: null, variant: 'strong' }],
		modifiers: {},
	},
	{
		name: 'Hunter’s Streak',
		description: 'Win 3 battles in a row without dying.',
		rewardHearts: 2,
		objectives: [{ kind: 'battle', kills: 3, biome: null, variant: null }],
		modifiers: {
			withoutDying: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'Balanced Slayer',
		description: 'Defeat 1 weak, 1 regular, and 1 strong monster.',
		rewardHearts: 2,
		objectives: [
			{ kind: 'battle', kills: 1, variant: 'weak', biome: null },
			{ kind: 'battle', kills: 1, variant: 'regular', biome: null },
			{ kind: 'battle', kills: 1, variant: 'strong', biome: null },
		],
		modifiers: {},
	},
	{
		name: 'Frontier Route',
		description: 'Visit forest, desert, and cave in one quest life.',
		rewardHearts: 2,
		objectives: [
			{ kind: 'visit', biome: 'forest', count: 1 },
			{ kind: 'visit', biome: 'desert', count: 1 },
			{ kind: 'visit', biome: 'cave', count: 1 },
		],
		modifiers: {
			resetOnDeath: true,
		},
	},
	{
		name: 'Treasure Fighter',
		description: 'Win 2 battles while carrying at least 1 unequipped item.',
		rewardHearts: 2,
		objectives: [{ kind: 'battle', kills: 2, biome: null, variant: null }],
		modifiers: {
			requiresUnequippedItem: true,
		},
	},
	{
		name: 'No Safe Haven',
		description: 'Defeat 3 monsters without stepping on a town tile.',
		rewardHearts: 2,
		objectives: [{ kind: 'battle', kills: 3, biome: null, variant: null }],
		modifiers: {
			withoutEnteringTown: true,
		},
	},

	// -----------------
	// Hard (+3 hearts)
	// -----------------
	{
		name: 'Cave Purge',
		description: 'Kill 3 monsters in cave without dying.',
		rewardHearts: 3,
		objectives: [{ kind: 'battle', kills: 3, biome: 'cave', variant: null }],
		modifiers: {
			withoutDying: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'Volcano Trial',
		description: 'Win 2 battles in volcano without dying.',
		rewardHearts: 3,
		objectives: [{ kind: 'battle', kills: 2, biome: 'volcano', variant: null }],
		modifiers: {
			withoutDying: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'Elite Breaker',
		description: 'Defeat 3 strong monsters without dying.',
		rewardHearts: 3,
		objectives: [{ kind: 'battle', kills: 3, biome: null, variant: 'strong' }],
		modifiers: {
			withoutDying: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'World Circuit',
		description: 'Win at least 1 battle in forest, desert, cave, and volcano.',
		rewardHearts: 3,
		objectives: [
			{ kind: 'battle', kills: 1, biome: 'forest', variant: null },
			{ kind: 'battle', kills: 1, biome: 'desert', variant: null },
			{ kind: 'battle', kills: 1, biome: 'cave', variant: null },
			{ kind: 'battle', kills: 1, biome: 'volcano', variant: null },
		],
		modifiers: {},
	},
	{
		name: 'Iron Will',
		description: 'Complete 4 total battle wins without using consumables.',
		rewardHearts: 3,
		objectives: [{ kind: 'battle', kills: 4, biome: null, variant: null }],
		modifiers: {
			withoutUsingConsumables: true,
		},
	},
	{
		name: 'Volcanic Rampage',
		description: 'Defeat 4 monsters in volcano.',
		rewardHearts: 3,
		objectives: [{ kind: 'battle', kills: 4, biome: 'volcano', variant: null }],
		modifiers: {},
	},
	{
		name: 'Untouchable',
		description: 'Win 3 battles in a row without dying or using consumables.',
		rewardHearts: 3,
		objectives: [{ kind: 'battle', kills: 3, biome: null, variant: null }],
		modifiers: {
			withoutDying: true,
			withoutUsingConsumables: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'Master of the Plains',
		description: 'Win 2 battles in plains and 2 in forest without dying.',
		rewardHearts: 3,
		objectives: [
			{ kind: 'battle', kills: 2, biome: 'plains', variant: null },
			{ kind: 'battle', kills: 2, biome: 'forest', variant: null },
		],
		modifiers: {
			withoutDying: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'Relentless',
		description: 'Win 5 total battles without entering town.',
		rewardHearts: 3,
		objectives: [{ kind: 'battle', kills: 5, biome: null, variant: null }],
		modifiers: {
			withoutEnteringTown: true,
		},
	},
	{
		name: 'Treasure Guardian',
		description: 'Win 3 battles while carrying at least 1 unequipped item and without dying.',
		rewardHearts: 3,
		objectives: [{ kind: 'battle', kills: 3, biome: null, variant: null }],
		modifiers: {
			requiresUnequippedItem: true,
			withoutDying: true,
			resetOnDeath: true,
		},
	},
	{
		name: 'Grand Explorer',
		description: 'Visit all biomes (plains, forest, desert, cave, volcano) in one life.',
		rewardHearts: 3,
		objectives: [
			{ kind: 'visit', biome: 'plains', count: 1 },
			{ kind: 'visit', biome: 'forest', count: 1 },
			{ kind: 'visit', biome: 'desert', count: 1 },
			{ kind: 'visit', biome: 'cave', count: 1 },
			{ kind: 'visit', biome: 'volcano', count: 1 },
		],
		modifiers: {
			resetOnDeath: true,
		},
	},
];
