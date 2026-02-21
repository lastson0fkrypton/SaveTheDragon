export type PlayBiome = 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';
export type DeckType = 'easy' | 'medium' | 'hard';
export type MonsterVariant = 'weak' | 'normal' | 'strong';

export const DECK_TYPE_BY_BIOME: Record<PlayBiome, DeckType> = {
	plains: 'easy',
	forest: 'easy',
	desert: 'medium',
	cave: 'hard',
	volcano: 'hard',
};

export function getDeckTypeForBiome(biome: PlayBiome): DeckType {
	return DECK_TYPE_BY_BIOME[biome];
}
