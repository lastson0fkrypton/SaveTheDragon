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
			easy_encounter: {
				deck: 'easy_encounter',
				cards: [
					monster('weak_trollkin', 'Weak Trollkin', 'forest', 'trollkin.png', 18, 5, 0.45, 2, 0.25),
					monster('trollkin', 'Trollkin', 'forest', 'trollkin.png', 26, 7, 0.55, 3, 0.3),
					monster('strong_trollkin', 'Strong Trollkin', 'forest', 'trollkin.png', 34, 9, 0.6, 4, 0.35),
				],
				consumables,
			},
			easy_loot: {
				deck: 'easy_loot',
				cards: [{ kind: 'item', id: 'rusty_spoon', name: 'Rusty Spoon', type: 'weapon', img: 'rusty_spoon.png', attack: 4, attackChance: 0.6, defense: null, defenseChance: null }],
				consumables,
			},
			medium_encounter: {
				deck: 'medium_encounter',
				cards: [monster('weak_scorpion', 'Weak Scorpion', 'desert', 'scorpion.png', 20, 6, 0.5, 2, 0.25)],
				consumables,
			},
			medium_loot: {
				deck: 'medium_loot',
				cards: [{ kind: 'item', id: 'cola_bomb', name: 'Cola Bomb', type: 'weapon', img: 'cola_bomb.png', attack: 12, attackChance: 0.72, defense: null, defenseChance: null }],
				consumables,
			},
			hard_encounter: {
				deck: 'hard_encounter',
				cards: [monster('weak_skeleton', 'Weak Skeleton', 'volcano', 'skeleton.png', 24, 8, 0.55, 3, 0.3)],
				consumables,
			},
			hard_loot: {
				deck: 'hard_loot',
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
		expect(next.decks.easy_encounter.cards.length).toBe(3);
		expect(getDeckDefinitionsConfig()).not.toBeNull();
		expect(getDeckDefinition('easy', 'encounter')?.deck).toBe('easy_encounter');
	});

	it('throws when a required deck is missing', () => {
		const invalid = makeValidConfig();
		delete (invalid.decks as any).hard_loot;
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/hard_loot/i);
	});

	it('throws on unsupported card kind', () => {
		const invalid = makeValidConfig();
		(invalid.decks.easy_encounter.cards as any[]).push({ kind: 'mystery', id: 'forest_mystery' });
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/encounter deck cards must be kind 'monster'/i);
	});

	it('rejects chest cards in encounter decks', () => {
		const invalid = makeValidConfig();
		(invalid.decks.easy_encounter.cards as any[]).push({ kind: 'chest', id: 'forest_chest' });
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/encounter deck cards must be kind 'monster'/i);
	});

	it('rejects heart cards in loot decks', () => {
		const invalid = makeValidConfig();
		(invalid.decks.easy_loot.cards as any[]).push({ kind: 'heart', id: 'bonus_heart', hearts: 1 });
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/loot deck cards must be kind 'item'/i);
	});

	it('rejects consumable item cards in loot decks', () => {
		const invalid = makeValidConfig();
		(invalid.decks.easy_loot.cards as any[]).push({
			kind: 'item',
			id: 'full_potion',
			name: 'Full Health Potion',
			type: 'item',
			img: 'full_potion.png',
			effect: 'heal_full',
			heal: null,
		});
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/loot deck cards must be type 'weapon' or 'armor'/i);
	});

	it('throws when consumables section is missing', () => {
		const invalid = makeValidConfig();
		delete (invalid.decks.easy_loot as any).consumables;
		expect(() => setDeckDefinitionsConfig(invalid)).toThrow(/consumables/i);
	});
});
