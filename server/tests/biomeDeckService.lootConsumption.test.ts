import { describe, expect, it } from 'vitest';
import { resetDeckDefinitionsConfig, setDeckDefinitionsConfig } from '../config/deckDefinitionsConfig.js';
import { createBiomeDeckRuntime, drawEncounterCard, drawLootCard } from '../services/biomeDeckService.js';

function setupDeckConfigForLootConsumptionTests() {
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
			easy_encounter: {
				deck: 'easy_encounter',
				cards: [
					{ kind: 'monster', id: 'weak_bat', name: 'Weak Bat', biome: 'forest', img: 'bat.png', health: 4, attack: 2, attackChance: 0.5, defense: 0, defenseChance: 0.25 },
				],
				consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0, chest: 1 },
			},
			easy_loot: {
				deck: 'easy_loot',
				cards: [
					{ kind: 'item', id: 'forest_spaghetti_whip', name: 'Spaghetti Whip', type: 'weapon', biome: 'forest', img: 'spaghetti_whip.png', attack: 4, attackChance: 0.6, defense: null, defenseChance: null, heal: null, effect: null },
				],
				consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 },
			},
			medium_encounter: {
				deck: 'medium_encounter',
				cards: [
					{ kind: 'monster', id: 'weak_scorpion', name: 'Weak Scorpion', biome: 'desert', img: 'scorpion.png', health: 5, attack: 2, attackChance: 0.5, defense: 0, defenseChance: 0.25 },
				],
				consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0, chest: 0 },
			},
			medium_loot: {
				deck: 'medium_loot',
				cards: [
					{ kind: 'item', id: 'desert_sand_blade', name: 'Sand Blade', type: 'weapon', biome: 'desert', img: 'sand_blade.png', attack: 5, attackChance: 0.55, defense: null, defenseChance: null, heal: null, effect: null },
				],
				consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 },
			},
			hard_encounter: {
				deck: 'hard_encounter',
				cards: [
					{ kind: 'monster', id: 'weak_imp', name: 'Weak Imp', biome: 'volcano', img: 'imp.png', health: 6, attack: 3, attackChance: 0.5, defense: 1, defenseChance: 0.25 },
				],
				consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0, chest: 0 },
			},
			hard_loot: {
				deck: 'hard_loot',
				cards: [
					{ kind: 'item', id: 'volcano_lava_axe', name: 'Lava Axe', type: 'weapon', biome: 'volcano', img: 'lava_axe.png', attack: 6, attackChance: 0.5, defense: null, defenseChance: null, heal: null, effect: null },
				],
				consumables: { teleport: 0, smallHealthPotion: 0, mediumHealthPotion: 0, largeHealthPotion: 0, fullHealthPotion: 0, extraHeart: 0 },
			},
		},
	});
}

describe('biomeDeckService loot consumption', () => {
	it('drawLootCard removes the rewarded card from active loot deck', () => {
		setupDeckConfigForLootConsumptionTests();
		const runtime = createBiomeDeckRuntime();
		const beforeLootCount = runtime.easy.loot.length;
		const beforeDiscardCount = runtime.easy.lootDiscard.length;

		const reward = drawLootCard(runtime, 'forest');

		expect(reward.kind === 'item' || reward.kind === 'consumable' || reward.kind === 'heart').toBe(true);
		expect(runtime.easy.loot.length).toBe(beforeLootCount - 1);
		expect(runtime.easy.lootDiscard.length).toBe(beforeDiscardCount);
	});

	it('chest-triggered loot reward is consumed from forest loot deck', () => {
		setupDeckConfigForLootConsumptionTests();
		const runtime = createBiomeDeckRuntime();

		let sawChest = false;
		for (let index = 0; index < 2; index += 1) {
			const encounter = drawEncounterCard(runtime, 'forest');
			if (encounter.kind === 'chest') {
				sawChest = true;
				break;
			}
		}
		expect(sawChest).toBe(true);

		const beforeLootCount = runtime.easy.loot.length;
		const beforeDiscardCount = runtime.easy.lootDiscard.length;
		drawLootCard(runtime, 'forest');
		expect(runtime.easy.loot.length).toBe(beforeLootCount - 1);
		expect(runtime.easy.lootDiscard.length).toBe(beforeDiscardCount);
	});
});
