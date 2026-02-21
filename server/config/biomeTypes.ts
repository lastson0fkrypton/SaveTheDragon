export type PlayBiome = 'plains' | 'forest' | 'desert' | 'cave' | 'volcano';
export type DeckType = 'forest' | 'desert' | 'volcano';
export type MonsterVariant = 'weak' | 'normal' | 'strong';

export const DECK_TYPE_BY_BIOME: Record<PlayBiome, DeckType> = {
	plains: 'forest',
	forest: 'forest',
	desert: 'desert',
	cave: 'volcano',
	volcano: 'volcano',
};

export const TEMPLATE_BIOME_BY_DECK_TYPE: Record<DeckType, PlayBiome> = {
	forest: 'forest',
	desert: 'desert',
	volcano: 'volcano',
};

export function getDeckTypeForBiome(biome: PlayBiome): DeckType {
	return DECK_TYPE_BY_BIOME[biome];
}

export function getTemplateBiomeForDeckType(deckType: DeckType): PlayBiome {
	return TEMPLATE_BIOME_BY_DECK_TYPE[deckType];
}
