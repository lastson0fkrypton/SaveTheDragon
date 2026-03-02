export type PlayBiome = 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';

export type QuestDifficultyTier = 'easy' | 'medium' | 'hard';
export type QuestArchetype = 'traveller' | 'battler';

export type QuestTypeModifier = {
	traveller?: number;
	battler?: number;
};

export type QuestTierModifier = {
	numberOfQuests: number;
	numberOfObjectives: number;
	rewardHearts: number;
	questTypes: QuestTypeModifier;
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

