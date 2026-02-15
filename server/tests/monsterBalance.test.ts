import { describe, expect, it } from 'vitest';
import { MONSTER_DEFS } from '../constants/monsters.js';

type MonsterDef = (typeof MONSTER_DEFS)[number];

function forBiome(biome: string) {
	return MONSTER_DEFS.filter(monster => monster.biome.split(',').includes(biome));
}

function averageThreat(monsters: MonsterDef[]) {
	const total = monsters.reduce((sum, monster) => {
		return sum + monster.health + monster.attack * 2 + monster.defense + monster.attackChance * 2 + monster.defenseChance;
	}, 0);
	return total / monsters.length;
}

describe('monster biome tier balancing', () => {
	it('keeps clear average threat progression from plains/forest to desert to cave/volcano', () => {
		const plainsThreat = averageThreat(forBiome('plains'));
		const forestThreat = averageThreat(forBiome('forest'));
		const desertThreat = averageThreat(forBiome('desert'));
		const caveThreat = averageThreat(forBiome('cave'));
		const volcanoThreat = averageThreat(forBiome('volcano'));

		expect(plainsThreat).toBeLessThan(desertThreat);
		expect(forestThreat).toBeLessThan(desertThreat);
		expect(desertThreat).toBeLessThan(caveThreat);
		expect(desertThreat).toBeLessThan(volcanoThreat);
	});

	it('ensures weak/normal/strong variants scale monotonically within each biome family', () => {
		const sampleBiomes = ['plains', 'desert', 'cave'];

		for (const biome of sampleBiomes) {
			const monsters = forBiome(biome);
			const byFamily = new Map<string, Partial<Record<'weak' | 'normal' | 'strong', MonsterDef>>>();

			for (const monster of monsters) {
				let familyKey = monster.id;
				let variant: 'weak' | 'normal' | 'strong' = 'normal';
				if (monster.id.startsWith('weak_')) {
					familyKey = monster.id.replace(/^weak_/, '');
					variant = 'weak';
				} else if (monster.id.startsWith('strong_')) {
					familyKey = monster.id.replace(/^strong_/, '');
					variant = 'strong';
				}

				const existing = byFamily.get(familyKey) || {};
				existing[variant] = monster;
				byFamily.set(familyKey, existing);
			}

			for (const family of byFamily.values()) {
				if (!family.weak || !family.normal || !family.strong) continue;

				expect(family.weak.health).toBeLessThan(family.normal.health);
				expect(family.normal.health).toBeLessThan(family.strong.health);
				expect(family.weak.attack).toBeLessThan(family.normal.attack);
				expect(family.normal.attack).toBeLessThan(family.strong.attack);
				expect(family.weak.defense).toBeLessThan(family.normal.defense);
				expect(family.normal.defense).toBeLessThan(family.strong.defense);
				expect(family.weak.attackChance).toBeLessThan(family.normal.attackChance);
				expect(family.normal.attackChance).toBeLessThan(family.strong.attackChance);
				expect(family.weak.defenseChance).toBeLessThan(family.normal.defenseChance);
				expect(family.normal.defenseChance).toBeLessThan(family.strong.defenseChance);
			}
		}
	});
});
