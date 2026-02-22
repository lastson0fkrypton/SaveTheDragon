import { MonsterCatalogSourceEntry } from '../models/monsterTypes.js';

export const EVIL_PRINCESS_MONSTER: MonsterCatalogSourceEntry = {
	id: 'evil_princess',
	name: 'Evil Princess',
	img: 'evil_princess.png',
};

// --- Monster definitions ---
const FOREST_MONSTER_CATALOG: ReadonlyArray<MonsterCatalogSourceEntry> = [
	// Plains/Forest
	{ id: 'trollkin', name: 'Trollkin', img: 'trollkin.png' },
	{ id: 'bat', name: 'Bat', img: 'bat.png' },
	{ id: 'fairy', name: 'Fairy', img: 'fairy.png' },
	{ id: 'black_cat', name: 'Black Cat', img: 'black_cat.png' },
	{ id: 'goblin', name: 'Goblin', img: 'goblin.png' },
	{ id: 'bigfoot', name: 'Bigfoot', img: 'bigfoot.png' },
	{ id: 'giant_spider', name: 'Giant Spider', img: 'giant_spider.png' },
	{ id: 'ogre', name: 'Ogre', img: 'ogre.png' },
	{ id: 'warewolf', name: 'Warewolf', img: 'warewolf.png' },
];
const DESERT_MONSTER_CATALOG: ReadonlyArray<MonsterCatalogSourceEntry> = [
	// Desert
	{ id: 'spiky_lizard', name: 'Spiky Lizard', img: 'spiky_lizard.png' },
	{ id: 'scorpion', name: 'Scorpion', img: 'scorpion.png' },
	{ id: 'snake', name: 'Snake', img: 'snake.png' },
	{ id: 'vulture', name: 'Vulture', img: 'vulture.png' },
	{ id: 'harpy', name: 'Harpy', img: 'harpy.png' },
	{ id: 'centaur', name: 'Centaur', img: 'centaur.png' },
	{ id: 'sand_golem', name: 'Sand Golem', img: 'sand_golem.png' },
	{ id: 'pheonix', name: 'Pheonix', img: 'pheonix.png' },
	{ id: 'gryphon', name: 'Gryphon', img: 'gryphon.png' },
];
const VOLCANO_MONSTER_CATALOG: ReadonlyArray<MonsterCatalogSourceEntry> = [
	// Cave/Volcano
	{ id: 'fire_butterfly', name: 'Fire Butterfly', img: 'fire_butterfly.png' },
	{ id: 'magma_cube', name: 'Magma Cube', img: 'magma_cube.png' },
	{ id: 'ember_imp', name: 'Ember Imp', img: 'ember_imp.png' },
	{ id: 'skeleton', name: 'Skeleton', img: 'skeleton.png' },
	{ id: 'rock_troll', name: 'Rock Troll', img: 'rock_troll.png' },
	{ id: 'medusa', name: 'Medusa', img: 'medusa.png' },
	{ id: 'wizard', name: 'Wizard', img: 'wizard.png' },
	{ id: 'red_dragon', name: 'Red Dragon', img: 'red_dragon.png' },
	{ id: 'dark_unicorn', name: 'Dark Unicorn', img: 'dark_unicorn.png' },
];

export { FOREST_MONSTER_CATALOG, DESERT_MONSTER_CATALOG, VOLCANO_MONSTER_CATALOG };
