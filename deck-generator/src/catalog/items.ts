import { ConsumableCatalogSourceEntry, ItemCatalogSourceEntry, ItemDef } from '../models/itemTypes.js';

export const FIST_ITEM: ItemDef = {
	id: 'fist',
	name: 'Fist',
	type: 'weapon',
	img: 'fist.png',
};

// --- Item definitions ---
const FOREST_ITEM_CATALOG: ReadonlyArray<ItemCatalogSourceEntry> = [
	// Easy Weapons (plains, forest)
	{id: 'rusty_spoon',name: 'Rusty Spoon',type: 'weapon',img: 'rusty_spoon.png'},
	{id: 'foam_noodle',name: 'Foam Noodle',type: 'weapon',img: 'foam_noodle.png'},
	{id: 'rubber_chicken',name: 'Rubber Chicken',type: 'weapon',img: 'rubber_chicken.png'},
	{id: 'feather_duster',name: 'Feather Duster',type: 'weapon',img: 'feather_duster.png'},
	{id: 'banana_boomerang',name: 'Banana Boomerang',type: 'weapon',img: 'banana_boomerang.png'},
	{id: 'bubble_wrap_sword',name: 'Bubble Wrap Sword',type: 'weapon',img: 'bubble_wrap_sword.png'},
	{id: 'bubble_wand',name: 'Bubble Wand',type: 'weapon',img: 'bubble_wand.png'},
	{id: 'squirt_gun_blaster',name: 'Squirt Gun Blaster',type: 'weapon',img: 'squirt_gun_blaster.png'},
	{id: 'balloon_sword',name: 'Balloon Sword',type: 'weapon',img: 'balloon_sword.png'},
	{id: 'spaghetti_whip',name: 'Spaghetti Whip',type: 'weapon',img: 'spaghetti_whip.png'},
	{id: 'silly_string_shooter',name: 'Silly String Shooter',type: 'weapon',img: 'silly_string_shooter.png'},
	{id: 'cucumber_sword',name: 'Cucumber Sword',type: 'weapon',img: 'cucumber_sword.png'},
	{id: 'clown_nose_launcher',name: 'Clown Nose Launcher',type: 'weapon',img: 'clown_nose_launcher.png'},
	{id: 'balloon_launcher',name: 'Balloon Launcher',type: 'weapon',img: 'balloon_launcher.png'},
	{id: 'sausage_nunchucks',name: 'Sausage Nunchucks',type: 'weapon',img: 'sausage_nunchucks.png'},
	{id: 'bouncy_ball_blaster',name: 'Bouncy Ball Blaster',type: 'weapon',img: 'bouncy_ball_blaster.png'},
	{id: 'sock_with_a_rock',name: 'Sock with a Rock',type: 'weapon',img: 'sock_with_a_rock.png'},
	{id: 'pooper_scooper',name: 'Pooper Scooper',type: 'weapon',img: 'pooper_scooper.png'},
	// Easy Armor (plains, forest)
	{id: 'rubber_bracelet',name: 'Rubber Bracelet',type: 'armor',img: 'rubber_bracelet.png'},
	{id: 'popstick_shield',name: 'Popstick Shield',type: 'armor',img: 'popstick_shield.png'},
	{id: 'straw_hat',name: 'Straw Hat',type: 'armor',img: 'straw_hat.png'},
	{id: 'dog_collar_armbands',name: 'Dog Collar Armbands',type: 'armor',img: 'dog_collar_armbands.png'},
	{id: 'cardboard_gloves',name: 'Cardboard Gloves',type: 'armor',img: 'cardboard_gloves.png'},
	{id: 'steel_toeless_boots',name: 'Steel Toeless Boots',type: 'armor',img: 'steel_toeless_boots.png'},
	{id: 'tin_foil_shield',name: 'Tin Foil Shield',type: 'armor',img: 'tin_foil_shield.png'},
	{id: 'fuzzy_slippers',name: 'Fuzzy Slippers',type: 'armor',img: 'fuzzy_slippers.png'},
	{id: 'leather_undies',name: 'Leather Undies',type: 'armor',img: 'leather_undies.png'},
	{id: 'pizza_boots',name: 'Pizza Boots',type: 'armor',img: 'pizza_boots.png'},
	{id: 'jello_helmet',name: 'Jello Helmet',type: 'armor',img: 'jello_helmet.png'},
	{id: 'cardboard_chestplate',name: 'Cardboard Chestplate',type: 'armor',img: 'cardboard_chestplate.png'},
	{id: 'bubble_wrap_armor',name: 'Bubble Wrap Armor',type: 'armor',img: 'bubble_wrap_armor.png'},
	{id: 'booger_crown',name: 'Booger Crown',type: 'armor',img: 'booger_crown.png'},
	{id: 'cloud_gloves',name: 'Cloud Gloves',type: 'armor',img: 'cloud_gloves.png'},
	{id: 'toilet_seat_shield',name: 'Toilet Seat Shield',type: 'armor',img: 'toilet_seat_shield.png'},
	{id: 'patchwork_poncho',name: 'Patchwork Poncho',type: 'armor',img: 'patchwork_poncho.png'},
	{id: 'caterpillar_helmet',name: 'Caterpillar Helmet',type: 'armor',img: 'caterpillar_helmet.png'}
];

const DESERT_ITEM_CATALOG: ReadonlyArray<ItemCatalogSourceEntry> = [
	// Medium Weapons (desert)
	{id: 'cola_bomb',name: 'Cola Bomb',type: 'weapon',img: 'cola_bomb.png'},
	{id: 'feather_boomerang',name: 'Feather Boomerang',type: 'weapon',img: 'feather_boomerang.png'},
	{id: 'confetti_cannon',name: 'Confetti Cannon',type: 'weapon',img: 'confetti_cannon.png'},
	{id: 'spitwad_blowpipe',name: 'Spitwad Blowpipe',type: 'weapon',img: 'spitwad_blowpipe.png'},
	{id: 'paper_fan',name: 'Paper Fan',type: 'weapon',img: 'paper_fan.png'},
	{id: 'banana_slingshot',name: 'Banana Slingshot',type: 'weapon',img: 'banana_slingshot.png'},
	{id: 'red_licorice_whip',name: 'Red Licorice Whip',type: 'weapon',img: 'red_licorice_whip.png'},
	{id: 'mallow_catapult',name: 'Mallow Catapult',type: 'weapon',img: 'mallow_catapult.png'},
	{id: 'fart_bomb',name: 'Fart Bomb',type: 'weapon',img: 'fart_bomb.png'},
	{id: 'pogo_stick_lance',name: 'Pogo Stick Lance',type: 'weapon',img: 'pogo_stick_lance.png'},
	{id: 'jesters_scepter',name: "Jester's Scepter",type: 'weapon',img: 'jesters_scepter.png'},
	{id: 'jelly_bean_gun',name: 'Jelly Bean Gun',type: 'weapon',img: 'jelly_bean_gun.png'},
	{id: 'plunger_bow',name: 'Plunger Bow',type: 'weapon',img: 'plunger_bow.png'},
	{id: 'sharp_candy_cane',name: 'Sharp Candy Cane',type: 'weapon',img: 'sharp_candy_cane.png'},
	{id: 'glue_shooter',name: 'Glue Shooter',type: 'weapon',img: 'glue_shooter.png'},
	{id: 'baguette_sword',name: 'Baguette Sword',type: 'weapon',img: 'baguette_sword.png'},
	{id: 'rolling_pin_hammer',name: 'Rolling Pin Hammer',type: 'weapon',img: 'rolling_pin_hammer.png'},
	{id: 'exploding_ice_cream',name: 'Exploding Ice Cream',type: 'weapon',img: 'exploding_ice_cream.png'},
	// Medium Armor (desert)
	{id: 'ice_cream_armor',name: 'Ice Cream Armor',type: 'armor',img: 'ice_cream_armor.png'},
	{id: 'knittted_armor',name: 'Knittted Armor',type: 'armor',img: 'knittted_armor.png'},
	{id: 'kitty_crown',name: 'Kitty Crown',type: 'armor',img: 'kitty_crown.png'},
	{id: 'fuzzy_armguards',name: 'Fuzzy Armguards',type: 'armor',img: 'fuzzy_armguards.png'},
	{id: 'cow_leather_jacket',name: 'Cow Leather Jacket',type: 'armor',img: 'cow_leather_jacket.png'},
	{id: 'honey_helmet',name: 'Honey Helmet',type: 'armor',img: 'honey_helmet.png'},
	{id: 'vacuum_armor',name: 'Vacuum Armor',type: 'armor',img: 'vacuum_armor.png'},
	{id: 'crystal_boots',name: 'Crystal Boots',type: 'armor',img: 'crystal_boots.png'},
	{id: 'stained_glass_shield',name: 'Stained Glass Shield',type: 'armor',img: 'stained_glass_shield.png'},
	{id: 'jesters_cap',name: "Jester's Cap",type: 'armor',img: 'jesters_cap.png'},
	{id: 'colorful_quilted_tunic',name: 'Colorful Quilted Tunic',type: 'armor',img: 'colorful_quilted_tunic.png'},
	{id: 'feathered_boots',name: 'Feathered Boots',type: 'armor',img: 'feathered_boots.png'},
	{id: 'bamboo_armor',name: 'Bamboo Armor',type: 'armor',img: 'bamboo_armor.png'},
	{id: 'colander_helm',name: 'Colander Helm',type: 'armor',img: 'colander_helm.png'},
	{id: 'fox_helmet',name: 'Fox Helmet',type: 'armor',img: 'fox_helmet.png'},
	{id: 'metal_mittens',name: 'Metal Mittens',type: 'armor',img: 'metal_mittens.png'},
	{id: 'snail_shell_helmet',name: 'Snail Shell Helmet',type: 'armor',img: 'snail_shell_helmet.png'},
	{id: 'oven_armor',name: 'Oven Armor',type: 'armor',img: 'oven_armor.png'}
];

const VOLCANO_ITEM_CATALOG: ReadonlyArray<ItemCatalogSourceEntry> = [
	// Hard Weapons (volcano, cave)
	{id: 'exploding_pie',name: 'Exploding Pie',type: 'weapon',img: 'exploding_pie.png'},
	{id: 'flaming_tuba',name: 'Flaming Tuba',type: 'weapon',img: 'flaming_tuba.png'},
	{id: 'glass_hammer',name: 'Glass Hammer',type: 'weapon',img: 'glass_hammer.png'},
	{id: 'octopus_launcher',name: 'Octopus Launcher',type: 'weapon',img: 'octopus_launcher.png'},
	{id: 'gummy_bear_mace',name: 'Gummy Bear Mace',type: 'weapon',img: 'gummy_bear_mace.png'},
	{id: 'mud_shotgun',name: 'Mud Shotgun',type: 'weapon',img: 'mud_shotgun.png'},
	{id: 'whacky_wizard_staff',name: 'Whacky Wizard Staff',type: 'weapon',img: 'whacky_wizard_staff.png'},
	{id: 'bagpipe_cannon',name: 'Bagpipe Cannon',type: 'weapon',img: 'bagpipe_cannon.png'},
	{id: 'piranha_on_a_stick',name: 'Piranha on a Stick',type: 'weapon',img: 'piranha_on_a_stick.png'},
	{id: 'scorpion_tail_spear',name: 'Scorpion tail Spear',type: 'weapon',img: 'scorpion_tail_spear.png'},
	{id: 'box_of_tiny_lion',name: 'Box of Tiny Lion',type: 'weapon',img: 'box_of_tiny_lion.png'},
	{id: 'danger_noodle_whip',name: 'Danger Noodle Whip',type: 'weapon',img: 'danger_noodle_whip.png'},
	{id: 'giggle_daggers',name: 'Giggle Daggers',type: 'weapon',img: 'giggle_daggers.png'},
	{id: 'rubber_chicken_axe',name: 'Rubber Chicken Axe',type: 'weapon',img: 'rubber_chicken_axe.png'},
	{id: 'shark_head_hammer',name: 'Shark Head Hammer',type: 'weapon',img: 'shark_head_hammer.png'},
	{id: 'roaring_great_sword',name: 'Roaring Great Sword',type: 'weapon',img: 'roaring_great_sword.png'},
	{id: 'wild_whirl_scythe',name: 'Wild Whirl Scythe',type: 'weapon',img: 'wild_whirl_scythe.png'},
	{id: 'crazy_cat_launcher',name: 'Crazy Cat Launcher',type: 'weapon',img: 'crazy_cat_launcher.png'},
	// Hard Armor (volcano, cave)
	{id: 'wooden_buckler',name: 'Wooden Buckler',type: 'armor',img: 'wooden_buckler.png'},
	{id: 'barrel_lid_shield',name: 'Barrel Lid Shield',type: 'armor',img: 'barrel_lid_shield.png'},
	{id: 'feather_helmet',name: 'Feather Helmet',type: 'armor',img: 'feather_helmet.png'},
	{id: 'plant_shield',name: 'Plant Shield',type: 'armor',img: 'plant_shield.png'},
	{id: 'sturdy_fish_shield',name: 'Sturdy Fish Shield',type: 'armor',img: 'sturdy_fish_shield.png'},
	{id: 'vortex_cape',name: 'Vortex Cape',type: 'armor',img: 'vortex_cape.png'},
	{id: 'clock_shield',name: 'Clock Shield',type: 'armor',img: 'clock_shield.png'},
	{id: 'spider_silk_gloves',name: 'Spider Silk Gloves',type: 'armor',img: 'spider_silk_gloves.png'},
	{id: 'lightning_shield',name: 'Lightning Shield',type: 'armor',img: 'lightning_shield.png'},
	{id: 'chicken_shield',name: 'Chicken Shield',type: 'armor',img: 'chicken_shield.png'},
	{id: 'guardian_shield',name: 'Guardian Shield',type: 'armor',img: 'guardian_shield.png'},
	{id: 'superhero_shield',name: 'Superhero Shield',type: 'armor',img: 'superhero_shield.png'},
	{id: 'boulder_armor',name: 'Boulder Armor',type: 'armor',img: 'boulder_armor.png'},
	{id: 'phoenix_cloak',name: 'Phoenix Cloak',type: 'armor',img: 'phoenix_cloak.png'},
	{id: 'shark_armor',name: 'Shark Armor',type: 'armor',img: 'shark_armor.png'},
	{id: 'serpent_scale',name: 'Serpent Scale',type: 'armor',img: 'serpent_scale.png'},
	{id: 'dragon_scale_armor',name: 'Dragon Scale Armor',type: 'armor',img: 'dragon_scale_armor.png'},
	{id: 'astral_plate_armor',name: 'Astral Plate Armor',type: 'armor',img: 'astral_plate_armor.png'}
];

const CONSUMABLE_ITEM_CATALOG: ReadonlyArray<ConsumableCatalogSourceEntry> = [
	// Items
	{ id: 'teleport', name: 'Teleport', effect: 'teleport', img: 'teleport.png' },
	{ id: 'small_potion', name: 'Small Health Potion', effect: 'heal_small', img: 'small_potion.png' },
	{ id: 'medium_potion',name: 'Medium Health Potion',effect: 'heal_medium',img: 'medium_potion.png'},
	{ id: 'large_potion', name: 'Large Health Potion', effect: 'heal_large', img: 'large_potion.png' },
	{ id: 'full_potion', name: 'Full Health Potion', effect: 'heal_full', img: 'full_potion.png' },
	{ id: 'extra_heart',name: 'Additional Heart',effect: 'extra_heart',img: 'extra_heart.png'},
];

export { FOREST_ITEM_CATALOG, DESERT_ITEM_CATALOG, VOLCANO_ITEM_CATALOG, CONSUMABLE_ITEM_CATALOG };
