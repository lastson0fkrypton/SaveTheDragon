import { describe, expect, it } from 'vitest';
import { resetDeckDefinitionsConfig, setDeckDefinitionsConfig } from '../config/deckDefinitionsConfig.js';
import { assertRequiredGameItems } from '../services/gameService.js';

describe('gameService required item guards', () => {
	it('throws when extra_heart item definition is missing', () => {
		resetDeckDefinitionsConfig();
		setDeckDefinitionsConfig({
			'final-boss': {
				id: 'evil_princess',
				name: 'Evil Princess',
				biome: 'castle',
				health: 120,
				attack: 8,
				attackChance: 0.85,
				defense: 5,
				defenseChance: 0.65,
				img: 'evil_princess.png',
			},
			startingItems: {
				weapon: { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', attack: 1, attackChance: 0.5 },
				armor: '',
			},
			itemDefinitions: {
				fist: { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', attack: 1, attackChance: 0.5 },
				teleport: { id: 'teleport', name: 'Teleport', type: 'item', biome: 'any', effect: 'teleport' },
			},
			decks: {
				forest_encounter: { deck: 'forest_encounter', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				forest_loot: { deck: 'forest_loot', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				desert_encounter: { deck: 'desert_encounter', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				desert_loot: { deck: 'desert_loot', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				volcano_encounter: { deck: 'volcano_encounter', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				volcano_loot: { deck: 'volcano_loot', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
			},
		});
		expect(() => assertRequiredGameItems()).toThrow(/extra_heart/i);
	});

	it('does not throw when extra_heart item definition exists', () => {
		resetDeckDefinitionsConfig();
		setDeckDefinitionsConfig({
			'final-boss': {
				id: 'evil_princess',
				name: 'Evil Princess',
				biome: 'castle',
				health: 120,
				attack: 8,
				attackChance: 0.85,
				defense: 5,
				defenseChance: 0.65,
				img: 'evil_princess.png',
			},
			startingItems: {
				weapon: { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', attack: 1, attackChance: 0.5 },
				armor: '',
			},
			itemDefinitions: {
				fist: { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', attack: 1, attackChance: 0.5 },
				extra_heart: { id: 'extra_heart', name: 'Additional Heart', type: 'item', biome: 'any', effect: 'extra_heart' },
			},
			decks: {
				forest_encounter: { deck: 'forest_encounter', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				forest_loot: { deck: 'forest_loot', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				desert_encounter: { deck: 'desert_encounter', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				desert_loot: { deck: 'desert_loot', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				volcano_encounter: { deck: 'volcano_encounter', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				volcano_loot: { deck: 'volcano_loot', cards: [{ kind: 'item', id: 'fist' }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
			},
		});
		expect(() => assertRequiredGameItems()).not.toThrow();
	});
});
