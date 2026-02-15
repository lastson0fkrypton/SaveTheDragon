import type { ItemDef, ItemType } from '../types.js';

type ItemCatalogSourceEntry = {
	id: string;
	name: string;
	type: ItemType;
	biome: string;
	img: string;
	noRandom?: boolean | null;
	effect?: string | null;
	heal?: number | null;
	attack?: number | null;
	attackChance?: number | null;
	defense?: number | null;
	defenseChance?: number | null;
};

// --- Item definitions ---
const ITEM_CATALOG_SOURCE: ReadonlyArray<ItemCatalogSourceEntry> = [
	// Fist (starter, not random)
	{
		id: 'fist',
		name: 'Fist',
		type: 'weapon',
		biome: 'any',
		attack: 1,
		attackChance: 0.5,
		img: 'fist.png',
		noRandom: true,
	},
	// Easy Weapons (plains, forest)
	{
		id: 'rusty_spoon',
		name: 'Rusty Spoon',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'rusty_spoon.png',
	},
	{
		id: 'foam_noodle',
		name: 'Foam Noodle',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'foam_noodle.png',
	},
	{
		id: 'rubber_chicken',
		name: 'Rubber Chicken',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'rubber_chicken.png',
	},
	{
		id: 'feather_duster',
		name: 'Feather Duster',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'feather_duster.png',
	},
	{
		id: 'banana_boomerang',
		name: 'Banana Boomerang',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'banana_boomerang.png',
	},
	{
		id: 'bubble_wrap_sword',
		name: 'Bubble Wrap Sword',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'bubble_wrap_sword.png',
	},
	{
		id: 'bubble_wand',
		name: 'Bubble Wand',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'bubble_wand.png',
	},
	{
		id: 'squirt_gun_blaster',
		name: 'Squirt Gun Blaster',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'squirt_gun_blaster.png',
	},
	{
		id: 'balloon_sword',
		name: 'Balloon Sword',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'balloon_sword.png',
	},
	{
		id: 'spaghetti_whip',
		name: 'Spaghetti Whip',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'spaghetti_whip.png',
	},
	{
		id: 'silly_string_shooter',
		name: 'Silly String Shooter',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'silly_string_shooter.png',
	},
	{
		id: 'cucumber_sword',
		name: 'Cucumber Sword',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'cucumber_sword.png',
	},
	{
		id: 'clown_nose_launcher',
		name: 'Clown Nose Launcher',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'clown_nose_launcher.png',
	},
	{
		id: 'balloon_launcher',
		name: 'Balloon Launcher',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'balloon_launcher.png',
	},
	{
		id: 'sausage_nunchucks',
		name: 'Sausage Nunchucks',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'sausage_nunchucks.png',
	},
	{
		id: 'bouncy_ball_blaster',
		name: 'Bouncy Ball Blaster',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'bouncy_ball_blaster.png',
	},
	{
		id: 'sock_with_a_rock',
		name: 'Sock with a Rock',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'sock_with_a_rock.png',
	},
	{
		id: 'pooper_scooper',
		name: 'Pooper Scooper',
		type: 'weapon',
		biome: 'plains,forest',
		img: 'pooper_scooper.png',
	},
	// Easy Armor (plains, forest)
	{
		id: 'rubber_bracelet',
		name: 'Rubber Bracelet',
		type: 'armor',
		biome: 'plains,forest',
		img: 'rubber_bracelet.png',
	},
	{
		id: 'popstick_shield',
		name: 'Popstick Shield',
		type: 'armor',
		biome: 'plains,forest',
		img: 'popstick_shield.png',
	},
	{
		id: 'straw_hat',
		name: 'Straw Hat',
		type: 'armor',
		biome: 'plains,forest',
		img: 'straw_hat.png',
	},
	{
		id: 'dog_collar_armbands',
		name: 'Dog Collar Armbands',
		type: 'armor',
		biome: 'plains,forest',
		img: 'dog_collar_armbands.png',
	},
	{
		id: 'cardboard_gloves',
		name: 'Cardboard Gloves',
		type: 'armor',
		biome: 'plains,forest',
		img: 'cardboard_gloves.png',
	},
	{
		id: 'steel_toeless_boots',
		name: 'Steel Toeless Boots',
		type: 'armor',
		biome: 'plains,forest',
		img: 'steel_toeless_boots.png',
	},
	{
		id: 'tin_foil_shield',
		name: 'Tin Foil Shield',
		type: 'armor',
		biome: 'plains,forest',
		img: 'tin_foil_shield.png',
	},
	{
		id: 'fuzzy_slippers',
		name: 'Fuzzy Slippers',
		type: 'armor',
		biome: 'plains,forest',
		img: 'fuzzy_slippers.png',
	},
	{
		id: 'leather_undies',
		name: 'Leather Undies',
		type: 'armor',
		biome: 'plains,forest',
		img: 'leather_undies.png',
	},
	{
		id: 'pizza_boots',
		name: 'Pizza Boots',
		type: 'armor',
		biome: 'plains,forest',
		img: 'pizza_boots.png',
	},
	{
		id: 'jello_helmet',
		name: 'Jello Helmet',
		type: 'armor',
		biome: 'plains,forest',
		img: 'jello_helmet.png',
	},
	{
		id: 'cardboard_chestplate',
		name: 'Cardboard Chestplate',
		type: 'armor',
		biome: 'plains,forest',
		img: 'cardboard_chestplate.png',
	},
	{
		id: 'bubble_wrap_armor',
		name: 'Bubble Wrap Armor',
		type: 'armor',
		biome: 'plains,forest',
		img: 'bubble_wrap_armor.png',
	},
	{
		id: 'booger_crown',
		name: 'Booger Crown',
		type: 'armor',
		biome: 'plains,forest',
		img: 'booger_crown.png',
	},
	{
		id: 'cloud_gloves',
		name: 'Cloud Gloves',
		type: 'armor',
		biome: 'plains,forest',
		img: 'cloud_gloves.png',
	},
	{
		id: 'toilet_seat_shield',
		name: 'Toilet Seat Shield',
		type: 'armor',
		biome: 'plains,forest',
		img: 'toilet_seat_shield.png',
	},
	{
		id: 'patchwork_poncho',
		name: 'Patchwork Poncho',
		type: 'armor',
		biome: 'plains,forest',
		img: 'patchwork_poncho.png',
	},
	{
		id: 'caterpillar_helmet',
		name: 'Caterpillar Helmet',
		type: 'armor',
		biome: 'plains,forest',
		img: 'caterpillar_helmet.png',
	},
	// Medium Weapons (desert)
	{
		id: 'cola_bomb',
		name: 'Cola Bomb',
		type: 'weapon',
		biome: 'desert',
		img: 'cola_bomb.png',
	},
	{
		id: 'feather_boomerang',
		name: 'Feather Boomerang',
		type: 'weapon',
		biome: 'desert',
		img: 'feather_boomerang.png',
	},
	{
		id: 'confetti_cannon',
		name: 'Confetti Cannon',
		type: 'weapon',
		biome: 'desert',
		img: 'confetti_cannon.png',
	},
	{
		id: 'spitwad_blowpipe',
		name: 'Spitwad Blowpipe',
		type: 'weapon',
		biome: 'desert',
		img: 'spitwad_blowpipe.png',
	},
	{
		id: 'paper_fan',
		name: 'Paper Fan',
		type: 'weapon',
		biome: 'desert',
		img: 'paper_fan.png',
	},
	{
		id: 'banana_slingshot',
		name: 'Banana Slingshot',
		type: 'weapon',
		biome: 'desert',
		img: 'banana_slingshot.png',
	},
	{
		id: 'red_licorice_whip',
		name: 'Red Licorice Whip',
		type: 'weapon',
		biome: 'desert',
		img: 'red_licorice_whip.png',
	},
	{
		id: 'mallow_catapult',
		name: 'Mallow Catapult',
		type: 'weapon',
		biome: 'desert',
		img: 'mallow_catapult.png',
	},
	{
		id: 'fart_bomb',
		name: 'Fart Bomb',
		type: 'weapon',
		biome: 'desert',
		img: 'fart_bomb.png',
	},
	{
		id: 'pogo_stick_lance',
		name: 'Pogo Stick Lance',
		type: 'weapon',
		biome: 'desert',
		img: 'pogo_stick_lance.png',
	},
	{
		id: 'jesters_scepter',
		name: "Jester's Scepter",
		type: 'weapon',
		biome: 'desert',
		img: 'jesters_scepter.png',
	},
	{
		id: 'jelly_bean_gun',
		name: 'Jelly Bean Gun',
		type: 'weapon',
		biome: 'desert',
		img: 'jelly_bean_gun.png',
	},
	{
		id: 'plunger_bow',
		name: 'Plunger Bow',
		type: 'weapon',
		biome: 'desert',
		img: 'plunger_bow.png',
	},
	{
		id: 'sharp_candy_cane',
		name: 'Sharp Candy Cane',
		type: 'weapon',
		biome: 'desert',
		img: 'sharp_candy_cane.png',
	},
	{
		id: 'glue_shooter',
		name: 'Glue Shooter',
		type: 'weapon',
		biome: 'desert',
		img: 'glue_shooter.png',
	},
	{
		id: 'baguette_sword',
		name: 'Baguette Sword',
		type: 'weapon',
		biome: 'desert',
		img: 'baguette_sword.png',
	},
	{
		id: 'rolling_pin_hammer',
		name: 'Rolling Pin Hammer',
		type: 'weapon',
		biome: 'desert',
		img: 'rolling_pin_hammer.png',
	},
	{
		id: 'exploding_ice_cream',
		name: 'Exploding Ice Cream',
		type: 'weapon',
		biome: 'desert',
		img: 'exploding_ice_cream.png',
	},
	// Medium Armor (desert)
	{
		id: 'ice_cream_armor',
		name: 'Ice Cream Armor',
		type: 'armor',
		biome: 'desert',
		img: 'ice_cream_armor.png',
	},
	{
		id: 'knittted_armor',
		name: 'Knittted Armor',
		type: 'armor',
		biome: 'desert',
		img: 'knittted_armor.png',
	},
	{
		id: 'kitty_crown',
		name: 'Kitty Crown',
		type: 'armor',
		biome: 'desert',
		img: 'kitty_crown.png',
	},
	{
		id: 'fuzzy_armguards',
		name: 'Fuzzy Armguards',
		type: 'armor',
		biome: 'desert',
		img: 'fuzzy_armguards.png',
	},
	{
		id: 'cow_leather_jacket',
		name: 'Cow Leather Jacket',
		type: 'armor',
		biome: 'desert',
		img: 'cow_leather_jacket.png',
	},
	{
		id: 'honey_helmet',
		name: 'Honey Helmet',
		type: 'armor',
		biome: 'desert',
		img: 'honey_helmet.png',
	},
	{
		id: 'vacuum_armor',
		name: 'Vacuum Armor',
		type: 'armor',
		biome: 'desert',
		img: 'vacuum_armor.png',
	},
	{
		id: 'crystal_boots',
		name: 'Crystal Boots',
		type: 'armor',
		biome: 'desert',
		img: 'crystal_boots.png',
	},
	{
		id: 'stained_glass_shield',
		name: 'Stained Glass Shield',
		type: 'armor',
		biome: 'desert',
		img: 'stained_glass_shield.png',
	},
	{
		id: 'jesters_cap',
		name: "Jester's Cap",
		type: 'armor',
		biome: 'desert',
		img: 'jesters_cap.png',
	},
	{
		id: 'colorful_quilted_tunic',
		name: 'Colorful Quilted Tunic',
		type: 'armor',
		biome: 'desert',
		img: 'colorful_quilted_tunic.png',
	},
	{
		id: 'feathered_boots',
		name: 'Feathered Boots',
		type: 'armor',
		biome: 'desert',
		img: 'feathered_boots.png',
	},
	{
		id: 'bamboo_armor',
		name: 'Bamboo Armor',
		type: 'armor',
		biome: 'desert',
		img: 'bamboo_armor.png',
	},
	{
		id: 'colander_helm',
		name: 'Colander Helm',
		type: 'armor',
		biome: 'desert',
		img: 'colander_helm.png',
	},
	{
		id: 'fox_helmet',
		name: 'Fox Helmet',
		type: 'armor',
		biome: 'desert',
		img: 'fox_helmet.png',
	},
	{
		id: 'metal_mittens',
		name: 'Metal Mittens',
		type: 'armor',
		biome: 'desert',
		img: 'metal_mittens.png',
	},
	{
		id: 'snail_shell_helmet',
		name: 'Snail Shell Helmet',
		type: 'armor',
		biome: 'desert',
		img: 'snail_shell_helmet.png',
	},
	{
		id: 'oven_armor',
		name: 'Oven Armor',
		type: 'armor',
		biome: 'desert',
		img: 'oven_armor.png',
	},
	// Hard Weapons (volcano, cave)
	{
		id: 'exploding_pie',
		name: 'Exploding Pie',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'exploding_pie.png',
	},
	{
		id: 'flaming_tuba',
		name: 'Flaming Tuba',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'flaming_tuba.png',
	},
	{
		id: 'glass_hammer',
		name: 'Glass Hammer',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'glass_hammer.png',
	},
	{
		id: 'octopus_launcher',
		name: 'Octopus Launcher',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'octopus_launcher.png',
	},
	{
		id: 'gummy_bear_mace',
		name: 'Gummy Bear Mace',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'gummy_bear_mace.png',
	},
	{
		id: 'mud_shotgun',
		name: 'Mud Shotgun',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'mud_shotgun.png',
	},
	{
		id: 'whacky_wizard_staff',
		name: 'Whacky Wizard Staff',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'whacky_wizard_staff.png',
	},
	{
		id: 'bagpipe_cannon',
		name: 'Bagpipe Cannon',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'bagpipe_cannon.png',
	},
	{
		id: 'piranha_on_a_stick',
		name: 'Piranha on a Stick',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'piranha_on_a_stick.png',
	},
	{
		id: 'scorpion_tail_spear',
		name: 'Scorpion tail Spear',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'scorpion_tail_spear.png',
	},
	{
		id: 'box_of_tiny_lion',
		name: 'Box of Tiny Lion',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'box_of_tiny_lion.png',
	},
	{
		id: 'danger_noodle_whip',
		name: 'Danger Noodle Whip',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'danger_noodle_whip.png',
	},
	{
		id: 'giggle_daggers',
		name: 'Giggle Daggers',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'giggle_daggers.png',
	},
	{
		id: 'rubber_chicken_axe',
		name: 'Rubber Chicken Axe',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'rubber_chicken_axe.png',
	},
	{
		id: 'shark_head_hammer',
		name: 'Shark Head Hammer',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'shark_head_hammer.png',
	},
	{
		id: 'roaring_great_sword',
		name: 'Roaring Great Sword',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'roaring_great_sword.png',
	},
	{
		id: 'wild_whirl_scythe',
		name: 'Wild Whirl Scythe',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'wild_whirl_scythe.png',
	},
	{
		id: 'crazy_cat_launcher',
		name: 'Crazy Cat Launcher',
		type: 'weapon',
		biome: 'volcano,cave',
		img: 'crazy_cat_launcher.png',
	},
	// Hard Armor (volcano, cave)
	{
		id: 'wooden_buckler',
		name: 'Wooden Buckler',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'wooden_buckler.png',
	},
	{
		id: 'barrel_lid_shield',
		name: 'Barrel Lid Shield',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'barrel_lid_shield.png',
	},
	{
		id: 'feather_helmet',
		name: 'Feather Helmet',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'feather_helmet.png',
	},
	{
		id: 'plant_shield',
		name: 'Plant Shield',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'plant_shield.png',
	},
	{
		id: 'sturdy_fish_shield',
		name: 'Sturdy Fish Shield',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'sturdy_fish_shield.png',
	},
	{
		id: 'vortex_cape',
		name: 'Vortex Cape',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'vortex_cape.png',
	},
	{
		id: 'clock_shield',
		name: 'Clock Shield',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'clock_shield.png',
	},
	{
		id: 'spider_silk_gloves',
		name: 'Spider Silk Gloves',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'spider_silk_gloves.png',
	},
	{
		id: 'lightning_shield',
		name: 'Lightning Shield',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'lightning_shield.png',
	},
	{
		id: 'chicken_shield',
		name: 'Chicken Shield',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'chicken_shield.png',
	},
	{
		id: 'guardian_shield',
		name: 'Guardian Shield',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'guardian_shield.png',
	},
	{
		id: 'superhero_shield',
		name: 'Superhero Shield',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'superhero_shield.png',
	},
	{
		id: 'boulder_armor',
		name: 'Boulder Armor',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'boulder_armor.png',
	},
	{
		id: 'phoenix_cloak',
		name: 'Phoenix Cloak',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'phoenix_cloak.png',
	},
	{
		id: 'shark_armor',
		name: 'Shark Armor',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'shark_armor.png',
	},
	{
		id: 'serpent_scale',
		name: 'Serpent Scale',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'serpent_scale.png',
	},
	{
		id: 'dragon_scale_armor',
		name: 'Dragon Scale Armor',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'dragon_scale_armor.png',
	},
	{
		id: 'astral_plate_armor',
		name: 'Astral Plate Armor',
		type: 'armor',
		biome: 'volcano,cave',
		img: 'astral_plate_armor.png',
	},
	// Items
	{ id: 'teleport', name: 'Teleport', type: 'item', biome: 'any', effect: 'teleport', img: 'teleport.png' },
	{ id: 'small_potion', name: 'Small Health Potion', type: 'item', biome: 'any', img: 'small_potion.png' },
	{
		id: 'medium_potion',
		name: 'Medium Health Potion',
		type: 'item',
		biome: 'any',
		img: 'medium_potion.png',
	},
	{ id: 'large_potion', name: 'Large Health Potion', type: 'item', biome: 'any', img: 'large_potion.png' },
	{ id: 'full_potion', name: 'Full Health Potion', type: 'item', biome: 'any', img: 'full_potion.png' },
	{
		id: 'extra_heart',
		name: 'Additional Heart',
		type: 'item',
		biome: 'any',
		effect: 'extra_heart',
		img: 'extra_heart.png',
	},
];

const BASE_ITEM_DEFS: ReadonlyArray<ItemDef> = ITEM_CATALOG_SOURCE.map(item => {
	const { id, name, type, biome, img, noRandom, effect, heal, attack, attackChance, defense, defenseChance } = item;
	const baseDef: ItemDef = {
		id,
		name,
		type,
		biome,
		img,
	};

	if (noRandom) {
		baseDef.noRandom = true;
		if (typeof attack === 'number') baseDef.attack = attack;
		if (typeof attackChance === 'number') baseDef.attackChance = attackChance;
		if (typeof defense === 'number') baseDef.defense = defense;
		if (typeof defenseChance === 'number') baseDef.defenseChance = defenseChance;
	}

	if (effect) baseDef.effect = effect;
	if (typeof heal === 'number') baseDef.heal = heal;

	return baseDef;
});

const ITEM_TIER_RANK = {
	plains: 1,
	forest: 1,
	desert: 2,
	cave: 3,
	volcano: 3,
};

const ITEM_TIER_BASE = {
	weapon: {
		1: { attack: 2, attackChance: 0.62 },
		2: { attack: 4, attackChance: 0.74 },
		3: { attack: 6, attackChance: 0.84 },
	},
	armor: {
		1: { defense: 2, defenseChance: 0.62 },
		2: { defense: 4, defenseChance: 0.74 },
		3: { defense: 6, defenseChance: 0.84 },
	},
};

const ITEM_VARIANT_MODIFIERS = {
	cracked: { valueDelta: -1, chanceDelta: -0.08 },
	normal: { valueDelta: 0, chanceDelta: 0 },
	enchanted: { valueDelta: 1, chanceDelta: 0.08 },
};

const ITEM_VARIANTS: ReadonlyArray<'cracked' | 'normal' | 'enchanted'> = ['cracked', 'normal', 'enchanted'];

function clampChance(value: number) {
	return Math.max(0.15, Math.min(0.95, Number(value.toFixed(2))));
}

function resolveItemTier(itemBiome: string): number {
	const biomes = (itemBiome || '')
		.split(',')
		.map(part => part.trim())
		.filter(Boolean);
	let tier = 1;
	for (const biome of biomes) {
		const rank = ITEM_TIER_RANK[biome] || 0;
		if (rank > tier) tier = rank;
	}
	return tier;
}

function toVariantId(baseId: string, variant: 'cracked' | 'normal' | 'enchanted') {
	if (variant === 'cracked') return `cracked_${baseId}`;
	if (variant === 'enchanted') return `enchanted_${baseId}`;
	return baseId;
}

function toVariantName(baseName: string, variant: 'cracked' | 'normal' | 'enchanted') {
	if (variant === 'cracked') return `Cracked ${baseName}`;
	if (variant === 'enchanted') return `Enchanted ${baseName}`;
	return baseName;
}

function rebalanceConsumable(itemDef: ItemDef): ItemDef {
	if (itemDef.id === 'small_potion') {
		return { ...itemDef, heal: 4 };
	}
	if (itemDef.id === 'medium_potion') {
		return { ...itemDef, heal: 7 };
	}
	if (itemDef.id === 'large_potion') {
		return { ...itemDef, heal: 11 };
	}
	if (itemDef.id === 'full_potion') {
		return { ...itemDef, heal: 999 };
	}
	return itemDef;
}

function applyItemBalance(
	itemDef: ItemDef,
	variant: 'cracked' | 'normal' | 'enchanted' = 'normal'
): ItemDef {
	if (itemDef.noRandom) {
		return itemDef;
	}

	if (itemDef.type === 'weapon') {
		const tier = resolveItemTier(itemDef.biome);
		const base = ITEM_TIER_BASE.weapon[tier] || ITEM_TIER_BASE.weapon[1];
		const mods = ITEM_VARIANT_MODIFIERS[variant] || ITEM_VARIANT_MODIFIERS.normal;
		return {
			...itemDef,
			id: toVariantId(itemDef.id, variant),
			name: toVariantName(itemDef.name, variant),
			attack: Math.max(2, base.attack + mods.valueDelta),
			attackChance: clampChance(Math.max(0.5, base.attackChance + mods.chanceDelta)),
		};
	}

	if (itemDef.type === 'armor') {
		const tier = resolveItemTier(itemDef.biome);
		const base = ITEM_TIER_BASE.armor[tier] || ITEM_TIER_BASE.armor[1];
		const mods = ITEM_VARIANT_MODIFIERS[variant] || ITEM_VARIANT_MODIFIERS.normal;
		return {
			...itemDef,
			id: toVariantId(itemDef.id, variant),
			name: toVariantName(itemDef.name, variant),
			defense: Math.max(1, base.defense + mods.valueDelta),
			defenseChance: clampChance(base.defenseChance + mods.chanceDelta),
		};
	}

	if (itemDef.type === 'item') {
		return rebalanceConsumable(itemDef);
	}

	return itemDef;
}

export const ITEM_DEFS = BASE_ITEM_DEFS.flatMap(itemDef => {
	if (itemDef.noRandom) return [itemDef];
	if (itemDef.type === 'item') return [rebalanceConsumable(itemDef)];
	return ITEM_VARIANTS.map(variant => applyItemBalance(itemDef, variant));
});
