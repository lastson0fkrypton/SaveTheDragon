import { MonsterCatalogSourceEntry, MonsterDef } from '../models/monsterTypes.js';

export const EVIL_PRINCESS_MONSTER: MonsterDef = {
	id: 'evil_princess',
	name: 'Evil Princess',
	biome: 'castle',
	health: 120,
	attack: 8,
	attackChance: 0.85,
	defense: 5,
	defenseChance: 0.65,
	img: 'evil_princess.png',
};

// --- Monster definitions ---
const FOREST_MONSTER_CATALOG: ReadonlyArray<MonsterCatalogSourceEntry> = [
	// Plains/Forest
	{ id: 'trollkin', name: 'Trollkin', biome: 'plains,forest', img: 'trollkin.png' },
	{ id: 'bat', name: 'Bat', biome: 'plains,forest', img: 'bat.png' },
	{ id: 'fairy', name: 'Fairy', biome: 'plains,forest', img: 'fairy.png' },
	{ id: 'black_cat', name: 'Black Cat', biome: 'plains,forest', img: 'black_cat.png' },
	{ id: 'goblin', name: 'Goblin', biome: 'plains,forest', img: 'goblin.png' },
	{ id: 'bigfoot', name: 'Bigfoot', biome: 'plains,forest', img: 'bigfoot.png' },
	{ id: 'giant_spider', name: 'Giant Spider', biome: 'plains,forest', img: 'giant_spider.png' },
	{ id: 'ogre', name: 'Ogre', biome: 'plains,forest', img: 'ogre.png' },
	{ id: 'warewolf', name: 'Warewolf', biome: 'plains,forest', img: 'warewolf.png' },
];
const DESERT_MONSTER_CATALOG: ReadonlyArray<MonsterCatalogSourceEntry> = [
	// Desert
	{ id: 'spiky_lizard', name: 'Spiky Lizard', biome: 'desert', img: 'spiky_lizard.png' },
	{ id: 'scorpion', name: 'Scorpion', biome: 'desert', img: 'scorpion.png' },
	{ id: 'snake', name: 'Snake', biome: 'desert', img: 'snake.png' },
	{ id: 'vulture', name: 'Vulture', biome: 'desert', img: 'vulture.png' },
	{ id: 'harpy', name: 'Harpy', biome: 'desert', img: 'harpy.png' },
	{ id: 'centaur', name: 'Centaur', biome: 'desert', img: 'centaur.png' },
	{ id: 'sand_golem', name: 'Sand Golem', biome: 'desert', img: 'sand_golem.png' },
	{ id: 'pheonix', name: 'Pheonix', biome: 'desert', img: 'pheonix.png' },
	{ id: 'gryphon', name: 'Gryphon', biome: 'desert', img: 'gryphon.png' },
];
const VOLCANO_MONSTER_CATALOG: ReadonlyArray<MonsterCatalogSourceEntry> = [
	// Cave/Volcano
	{ id: 'fire_butterfly', name: 'Fire Butterfly', biome: 'volcano,cave', img: 'fire_butterfly.png' },
	{ id: 'magma_cube', name: 'Magma Cube', biome: 'volcano,cave', img: 'magma_cube.png' },
	{ id: 'ember_imp', name: 'Ember Imp', biome: 'volcano,cave', img: 'ember_imp.png' },
	{ id: 'skeleton', name: 'Skeleton', biome: 'volcano,cave', img: 'skeleton.png' },
	{ id: 'rock_troll', name: 'Rock Troll', biome: 'volcano,cave', img: 'rock_troll.png' },
	{ id: 'medusa', name: 'Medusa', biome: 'volcano,cave', img: 'medusa.png' },
	{ id: 'wizard', name: 'Wizard', biome: 'volcano,cave', img: 'wizard.png' },
	{ id: 'red_dragon', name: 'Red Dragon', biome: 'volcano,cave', img: 'red_dragon.png' },
	{ id: 'dark_unicorn', name: 'Dark Unicorn', biome: 'volcano,cave', img: 'dark_unicorn.png' },
];

export { FOREST_MONSTER_CATALOG, DESERT_MONSTER_CATALOG, VOLCANO_MONSTER_CATALOG };
