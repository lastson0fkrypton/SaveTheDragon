import { describe, expect, it } from 'vitest';
import { ITEM_DEFS } from '../constants/items.js';

type ItemDef = (typeof ITEM_DEFS)[number];

function byBiomeAndType(biome: string, type: 'weapon' | 'armor') {
	return ITEM_DEFS.filter(item => item.type === type && item.biome.split(',').includes(biome));
}

function avg(items: ItemDef[], selector: (item: ItemDef) => number) {
	return items.reduce((sum, item) => sum + selector(item), 0) / items.length;
}

describe('item biome tier balancing', () => {
	it('keeps curved weapon progression from plains/forest to desert to cave/volcano', () => {
		const plainsWeapons = byBiomeAndType('plains', 'weapon');
		const forestWeapons = byBiomeAndType('forest', 'weapon');
		const desertWeapons = byBiomeAndType('desert', 'weapon');
		const caveWeapons = byBiomeAndType('cave', 'weapon');
		const volcanoWeapons = byBiomeAndType('volcano', 'weapon');

		expect(avg(plainsWeapons, item => item.attack || 0)).toBeLessThan(avg(desertWeapons, item => item.attack || 0));
		expect(avg(forestWeapons, item => item.attack || 0)).toBeLessThan(avg(desertWeapons, item => item.attack || 0));
		expect(avg(desertWeapons, item => item.attack || 0)).toBeLessThan(avg(caveWeapons, item => item.attack || 0));
		expect(avg(desertWeapons, item => item.attack || 0)).toBeLessThan(avg(volcanoWeapons, item => item.attack || 0));
		expect(avg(plainsWeapons, item => item.attackChance || 0)).toBeLessThan(avg(caveWeapons, item => item.attackChance || 0));
	});

	it('keeps curved armor progression from plains/forest to desert to cave/volcano', () => {
		const plainsArmor = byBiomeAndType('plains', 'armor');
		const forestArmor = byBiomeAndType('forest', 'armor');
		const desertArmor = byBiomeAndType('desert', 'armor');
		const caveArmor = byBiomeAndType('cave', 'armor');
		const volcanoArmor = byBiomeAndType('volcano', 'armor');

		expect(avg(plainsArmor, item => item.defense || 0)).toBeLessThan(avg(desertArmor, item => item.defense || 0));
		expect(avg(forestArmor, item => item.defense || 0)).toBeLessThan(avg(desertArmor, item => item.defense || 0));
		expect(avg(desertArmor, item => item.defense || 0)).toBeLessThan(avg(caveArmor, item => item.defense || 0));
		expect(avg(desertArmor, item => item.defense || 0)).toBeLessThan(avg(volcanoArmor, item => item.defense || 0));
		expect(avg(plainsArmor, item => item.defenseChance || 0)).toBeLessThan(avg(caveArmor, item => item.defenseChance || 0));
	});

	it('keeps starter fist stable and scales potion heals upward', () => {
		const fist = ITEM_DEFS.find(item => item.id === 'fist');
		const smallPotion = ITEM_DEFS.find(item => item.id === 'small_potion');
		const mediumPotion = ITEM_DEFS.find(item => item.id === 'medium_potion');
		const largePotion = ITEM_DEFS.find(item => item.id === 'large_potion');

		expect(fist?.attack).toBe(1);
		expect(fist?.attackChance).toBe(0.5);
		expect(smallPotion?.heal).toBeLessThan(mediumPotion?.heal || 0);
		expect(mediumPotion?.heal).toBeLessThan(largePotion?.heal || 0);
	});

	it('ensures random weapons are never weaker than fist baseline', () => {
		const randomWeapons = ITEM_DEFS.filter(item => item.type === 'weapon' && !item.noRandom);
		expect(randomWeapons.length).toBeGreaterThan(0);

		for (const weapon of randomWeapons) {
			expect(weapon.attack || 0).toBeGreaterThanOrEqual(2);
			expect(weapon.attackChance || 0).toBeGreaterThanOrEqual(0.5);
		}
	});
});
