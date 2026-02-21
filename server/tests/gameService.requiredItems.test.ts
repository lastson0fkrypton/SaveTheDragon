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
			initialPlayerState: {
				playerHealth: 5,
				playerWeapon: { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', img: 'fist.png', attack: 1, attackChance: 0.5 },
				playerArmor: '',
			},
			decks: {
				easy_encounter: { deck: 'easy_encounter', cards: [{ kind: 'monster', id: 'weak_bat', name: 'Weak Bat', biome: 'forest', img: 'bat.png', health: 4, attack: 2, attackChance: 0.5, defense: 0, defenseChance: 0.25 }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				easy_loot: { deck: 'easy_loot', cards: [{ kind: 'item', id: 'fist', name: 'Fist', type: 'weapon', img: 'fist.png', attack: 1, attackChance: 0.5, defense: null, defenseChance: null }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				medium_encounter: { deck: 'medium_encounter', cards: [{ kind: 'monster', id: 'weak_bat', name: 'Weak Bat', biome: 'desert', img: 'bat.png', health: 4, attack: 2, attackChance: 0.5, defense: 0, defenseChance: 0.25 }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				medium_loot: { deck: 'medium_loot', cards: [{ kind: 'item', id: 'fist', name: 'Fist', type: 'weapon', img: 'fist.png', attack: 1, attackChance: 0.5, defense: null, defenseChance: null }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				hard_encounter: { deck: 'hard_encounter', cards: [{ kind: 'monster', id: 'weak_bat', name: 'Weak Bat', biome: 'volcano', img: 'bat.png', health: 4, attack: 2, attackChance: 0.5, defense: 0, defenseChance: 0.25 }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				hard_loot: { deck: 'hard_loot', cards: [{ kind: 'item', id: 'fist', name: 'Fist', type: 'weapon', img: 'fist.png', attack: 1, attackChance: 0.5, defense: null, defenseChance: null }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
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
			initialPlayerState: {
				playerHealth: 5,
				playerWeapon: { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', img: 'fist.png', attack: 1, attackChance: 0.5 },
				playerArmor: '',
			},
			decks: {
				easy_encounter: { deck: 'easy_encounter', cards: [{ kind: 'monster', id: 'weak_bat', name: 'Weak Bat', biome: 'forest', img: 'bat.png', health: 4, attack: 2, attackChance: 0.5, defense: 0, defenseChance: 0.25 }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				easy_loot: { deck: 'easy_loot', cards: [{ kind: 'item', id: 'fist', name: 'Fist', type: 'weapon', img: 'fist.png', attack: 1, attackChance: 0.5, defense: null, defenseChance: null }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 1 } },
				medium_encounter: { deck: 'medium_encounter', cards: [{ kind: 'monster', id: 'weak_bat', name: 'Weak Bat', biome: 'desert', img: 'bat.png', health: 4, attack: 2, attackChance: 0.5, defense: 0, defenseChance: 0.25 }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				medium_loot: { deck: 'medium_loot', cards: [{ kind: 'item', id: 'fist', name: 'Fist', type: 'weapon', img: 'fist.png', attack: 1, attackChance: 0.5, defense: null, defenseChance: null }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				hard_encounter: { deck: 'hard_encounter', cards: [{ kind: 'monster', id: 'weak_bat', name: 'Weak Bat', biome: 'volcano', img: 'bat.png', health: 4, attack: 2, attackChance: 0.5, defense: 0, defenseChance: 0.25 }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
				hard_loot: { deck: 'hard_loot', cards: [{ kind: 'item', id: 'fist', name: 'Fist', type: 'weapon', img: 'fist.png', attack: 1, attackChance: 0.5, defense: null, defenseChance: null }], consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 } },
			},
		});
		expect(() => assertRequiredGameItems()).not.toThrow();
	});
});
