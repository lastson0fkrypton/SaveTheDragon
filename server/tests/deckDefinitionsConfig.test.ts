import { afterEach, describe, expect, it } from 'vitest';
import {
	getDeckDefinition,
	getDeckDefinitionsConfig,
	resetDeckDefinitionsConfig,
	setDeckDefinitionsConfig,
} from '../config/deckDefinitionsConfig.js';

function makeValidConfig() {
	const consumables = {
		teleport: 1,
		smallHealthPotion: 3,
		mediumHealthPotion: 2,
		largeHealthPotion: 1,
		fullHealthPotion: 1,
		extraHeart: 1,
	};

	const fist = {
		id: 'fist',
		name: 'Fist',
		type: 'weapon',
		img: 'fist.png',
		biome: 'any',
		attack: 1,
		attackChance: 0.5,
	};

	const monster = (
		id: string,
		name: string,
		biome: string,
		img: string,
		health: number,
		attack: number,
		attackChance: number,
		defense: number,
		defenseChance: number,
	) => ({
		kind: 'monster' as const,
		id,
		name,
		biome,
		img,
		health,
		attack,
		attackChance,
		defense,
		defenseChance,
	});

	return {
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
			playerWeapon: fist,
			playerArmor: '',
		},
		decks: {
			forest_encounter: {
				deck: 'forest_encounter',
				cards: [
					monster('weak_trollkin', 'Weak Trollkin', 'forest', 'trollkin.png', 18, 5, 0.45, 2, 0.25),
					monster('trollkin', 'Trollkin', 'forest', 'trollkin.png', 26, 7, 0.55, 3, 0.3),
					monster('strong_trollkin', 'Strong Trollkin', 'forest', 'trollkin.png', 34, 9, 0.6, 4, 0.35),
				],
				consumables,
			},
			forest_loot: {
				deck: 'forest_loot',
				cards: [{ kind: 'item', id: 'rusty_spoon', name: 'Rusty Spoon', type: 'weapon', img: 'rusty_spoon.png', attack: 4, attackChance: 0.6, defense: null, defenseChance: null }],
				consumables,
			},
			desert_encounter: {
				deck: 'desert_encounter',
				cards: [monster('weak_scorpion', 'Weak Scorpion', 'desert', 'scorpion.png', 20, 6, 0.5, 2, 0.25)],
				consumables,
			},
			desert_loot: {
				deck: 'desert_loot',
				cards: [{ kind: 'item', id: 'cola_bomb', name: 'Cola Bomb', type: 'weapon', img: 'cola_bomb.png', attack: 12, attackChance: 0.72, defense: null, defenseChance: null }],
				consumables,
			},
			volcano_encounter: {
				deck: 'volcano_encounter',
				cards: [monster('weak_skeleton', 'Weak Skeleton', 'volcano', 'skeleton.png', 24, 8, 0.55, 3, 0.3)],
				consumables,
			},
			volcano_loot: {
				deck: 'volcano_loot',
				cards: [{ kind: 'item', id: 'magma_blade', name: 'Magma Blade', type: 'weapon', img: 'magma_blade.png', attack: 17, attackChance: 0.82, defense: null, defenseChance: null }],
				consumables,
			},
		},
	};
}

describe('deckDefinitionsConfig', () => {
	afterEach(() => {
		resetDeckDefinitionsConfig();
	});

	it('accepts valid explicit deck definitions', () => {
		const next = setDeckDefinitionsConfig(makeValidConfig());
		expect(next.decks.forest_encounter.cards.length).toBe(3);
		expect(getDeckDefinitionsConfig()).not.toBeNull();
		expect(getDeckDefinition('forest', 'encounter')?.deck).toBe('forest_encounter');
	});

	it('throws when a required deck is missing', () => {
		const invalid = makeValidConfig();
		delete (invalid.decks as any).volcano_loot;
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/volcano_loot/i);
	});

	it('throws on unsupported card kind', () => {
		const invalid = makeValidConfig();
		(invalid.decks.forest_encounter.cards as any[]).push({ kind: 'mystery', id: 'forest_mystery' });
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/unsupported kind/i);
	});

	it('accepts chest cards in encounter decks', () => {
		const valid = makeValidConfig();
		(valid.decks.forest_encounter.cards as any[]).push({ kind: 'chest', id: 'forest_chest' });
		expect(() => setDeckDefinitionsConfig(valid)).not.toThrow();
	});

	it('throws when consumables section is missing', () => {
		const invalid = makeValidConfig();
		delete (invalid.decks.forest_loot as any).consumables;
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/consumables/i);
	});
});
