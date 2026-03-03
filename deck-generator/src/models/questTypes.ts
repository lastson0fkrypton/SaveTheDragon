export type PlayBiome = 'any' | 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';

export type Quest = {
	name: string;
	description: string;
	rewardHearts: number;
	objectives: QuestObjective[];
	modifiers: QuestModifiers;
};

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
		variant?: 'weak' | 'regular' | 'strong' | null;
	};

export type QuestModifiers = {
	withoutDying?: boolean;
	withoutUsingConsumables?: boolean;
	resetOnDeath?: boolean;
	requiresUnequippedItem?: boolean;
	withoutEnteringTown?: boolean;
	requiresConsumableThenWin?: boolean;
};

