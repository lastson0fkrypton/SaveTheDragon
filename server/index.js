import express from 'express';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import path from 'path';

const app = express();
const PORT = 3000;

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    gameStateJson TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    gameId TEXT,
    name TEXT,
    playerStateJson TEXT,
    FOREIGN KEY(gameId) REFERENCES games(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS valid_moves (
    gameId TEXT,
    x INTEGER,
    y INTEGER,
    FOREIGN KEY(gameId) REFERENCES games(id)
  )`);
});

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the dist folder
app.use(express.static('dist'));

// Track last poll time for each game
const lastPoll = {};
// --- SQLite-based game state persistence ---

// Helper: serialize a game from DB rows
function serializeGame(gameRow, playerRows, validMoveRows) {
  // Parse game state JSON
  const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
  // Parse player state JSONs
  const players = playerRows.map(p => {
    const playerState = p.playerStateJson ? JSON.parse(p.playerStateJson) : {};
    return {
      id: p.id,
      name: p.name,
      ...playerState
    };
  });
  // Attach item metadata for all items in play
  const allItemIds = new Set();
  players.forEach(p => {
    if (p.inventory) {
      (p.inventory.weapons || []).forEach(id => allItemIds.add(id));
      (p.inventory.armor || []).forEach(id => allItemIds.add(id));
      (p.inventory.items || []).forEach(id => allItemIds.add(id));
      if (p.inventory.equippedWeaponId) allItemIds.add(p.inventory.equippedWeaponId);
      if (p.inventory.equippedArmorId) allItemIds.add(p.inventory.equippedArmorId);
    }
  });
  if (gameState.recentlyFoundItem && gameState.recentlyFoundItem.item?.id) {
    allItemIds.add(gameState.recentlyFoundItem.item.id);
  }
  const itemMeta = {};
  ITEM_DEFS.forEach(def => { if (allItemIds.has(def.id)) itemMeta[def.id] = def; });
  return {
    id: gameRow.id,
    ...gameState,
    players,
    validMoves: validMoveRows.map(m => ({ x: m.x, y: m.y })),
    gridSizeX: gameState.gridSizeX || 10,
    gridSizeY: gameState.gridSizeY || 10,
    itemMeta
  };
}

// Helper to add a recent action to the game state
function addRecentAction(gameState, type, playerName, itemName) {
  if (!gameState.recentActions) gameState.recentActions = [];
  const action = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    type, // 'use-item' or 'equip'
    playerName,
    itemName,
    ts: Date.now()
  };
  gameState.recentActions.push(action);
  // Keep only the latest 10 actions
  if (gameState.recentActions.length > 10) gameState.recentActions = gameState.recentActions.slice(-10);
}

// --- Item definitions ---
const ITEM_DEFS = [
  // Fist (starter, not random)
  { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', attack: 1, hit: 3, img: 'fist.png', noRandom: true },
  // Easy Weapons (plains, forest)
  { id: 'rusty_spoon', name: 'Rusty Spoon', type: 'weapon', biome: 'plains,forest', attack: 1, hit: 3, img: 'rusty_spoon.png' },
  { id: 'foam_noodle', name: 'Foam Noodle', type: 'weapon', biome: 'plains,forest', attack: 1, hit: 4, img: 'foam_noodle.png' },
  { id: 'rubber_chicken', name: 'Rubber Chicken', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 5, img: 'rubber_chicken.png' },
  { id: 'feather_duster', name: 'Feather Duster', type: 'weapon', biome: 'plains,forest', attack: 1, hit: 4, img: 'feather_duster.png' },
  { id: 'banana_boomerang', name: 'Banana Boomerang', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 3, img: 'banana_boomerang.png' },
  { id: 'bubble_wrap_sword', name: 'Bubble Wrap Sword', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 5, img: 'bubble_wrap_sword.png' },
  { id: 'bubble_wand', name: 'Bubble Wand', type: 'weapon', biome: 'plains,forest', attack: 1, hit: 3, img: 'bubble_wand.png' },
  { id: 'squirt_gun_blaster', name: 'Squirt Gun Blaster', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 4, img: 'squirt_gun_blaster.png' },
  { id: 'balloon_sword', name: 'Balloon Sword', type: 'weapon', biome: 'plains,forest', attack: 1, hit: 5, img: 'balloon_sword.png' },
  { id: 'spaghetti_whip', name: 'Spaghetti Whip', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 3, img: 'spaghetti_whip.png' },
  { id: 'silly_string_shooter', name: 'Silly String Shooter', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 4, img: 'silly_string_shooter.png' },
  { id: 'cucumber_sword', name: 'Cucumber Sword', type: 'weapon', biome: 'plains,forest', attack: 1, hit: 5, img: 'cucumber_sword.png' },
  { id: 'clown_nose_launcher', name: 'Clown Nose Launcher', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 3, img: 'clown_nose_launcher.png' },
  { id: 'balloon_launcher', name: 'Balloon Launcher', type: 'weapon', biome: 'plains,forest', attack: 1, hit: 4, img: 'balloon_launcher.png' },
  { id: 'sausage_nunchucks', name: 'Sausage Nunchucks', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 5, img: 'sausage_nunchucks.png' },
  { id: 'bouncy_ball_blaster', name: 'Bouncy Ball Blaster', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 3, img: 'bouncy_ball_blaster.png' },
  { id: 'sock_with_a_rock', name: 'Sock with a Rock', type: 'weapon', biome: 'plains,forest', attack: 2, hit: 4, img: 'sock_with_a_rock.png' },
  { id: 'pooper_scooper', name: 'Pooper Scooper', type: 'weapon', biome: 'plains,forest', attack: 1, hit: 5, img: 'pooper_scooper.png' },
  // Easy Armor (plains, forest)
  { id: 'rubber_bracelet', name: 'Rubber Bracelet', type: 'armor', biome: 'plains,forest', defense: 1, block: 3, img: 'rubber_bracelet.png' },
  { id: 'popstick_shield', name: 'Popstick Shield', type: 'armor', biome: 'plains,forest', defense: 2, block: 4, img: 'popstick_shield.png' },
  { id: 'straw_hat', name: 'Straw Hat', type: 'armor', biome: 'plains,forest', defense: 1, block: 5, img: 'straw_hat.png' },
  { id: 'dog_collar_armbands', name: 'Dog Collar Armbands', type: 'armor', biome: 'plains,forest', defense: 2, block: 3, img: 'dog_collar_armbands.png' },
  { id: 'cardboard_gloves', name: 'Cardboard Gloves', type: 'armor', biome: 'plains,forest', defense: 1, block: 4, img: 'cardboard_gloves.png' },
  { id: 'steel_toeless_boots', name: 'Steel Toeless Boots', type: 'armor', biome: 'plains,forest', defense: 2, block: 5, img: 'steel_toeless_boots.png' },
  { id: 'tin_foil_shield', name: 'Tin Foil Shield', type: 'armor', biome: 'plains,forest', defense: 1, block: 3, img: 'tin_foil_shield.png' },
  { id: 'fuzzy_slippers', name: 'Fuzzy Slippers', type: 'armor', biome: 'plains,forest', defense: 2, block: 4, img: 'fuzzy_slippers.png' },
  { id: 'leather_undies', name: 'Leather Undies', type: 'armor', biome: 'plains,forest', defense: 1, block: 5, img: 'leather_undies.png' },
  { id: 'pizza_boots', name: 'Pizza Boots', type: 'armor', biome: 'plains,forest', defense: 2, block: 3, img: 'pizza_boots.png' },
  { id: 'jello_helmet', name: 'Jello Helmet', type: 'armor', biome: 'plains,forest', defense: 1, block: 4, img: 'jello_helmet.png' },
  { id: 'cardboard_chestplate', name: 'Cardboard Chestplate', type: 'armor', biome: 'plains,forest', defense: 2, block: 5, img: 'cardboard_chestplate.png' },
  { id: 'bubble_wrap_armor', name: 'Bubble Wrap Armor', type: 'armor', biome: 'plains,forest', defense: 1, block: 3, img: 'bubble_wrap_armor.png' },
  { id: 'booger_crown', name: 'Booger Crown', type: 'armor', biome: 'plains,forest', defense: 2, block: 4, img: 'booger_crown.png' },
  { id: 'cloud_gloves', name: 'Cloud Gloves', type: 'armor', biome: 'plains,forest', defense: 1, block: 5, img: 'cloud_gloves.png' },
  { id: 'toilet_seat_shield', name: 'Toilet Seat Shield', type: 'armor', biome: 'plains,forest', defense: 2, block: 3, img: 'toilet_seat_shield.png' },
  { id: 'patchwork_poncho', name: 'Patchwork Poncho', type: 'armor', biome: 'plains,forest', defense: 1, block: 4, img: 'patchwork_poncho.png' },
  { id: 'caterpillar_helmet', name: 'Caterpillar Helmet', type: 'armor', biome: 'plains,forest', defense: 2, block: 5, img: 'caterpillar_helmet.png' },
  // Medium Weapons (desert)
  { id: 'cola_bomb', name: 'Cola Bomb', type: 'weapon', biome: 'desert', attack: 3, hit: 3, img: 'cola_bomb.png' },
  { id: 'feather_boomerang', name: 'Feather Boomerang', type: 'weapon', biome: 'desert', attack: 3, hit: 4, img: 'feather_boomerang.png' },
  { id: 'confetti_cannon', name: 'Confetti Cannon', type: 'weapon', biome: 'desert', attack: 4, hit: 5, img: 'confetti_cannon.png' },
  { id: 'spitwad_blowpipe', name: 'Spitwad Blowpipe', type: 'weapon', biome: 'desert', attack: 3, hit: 5, img: 'spitwad_blowpipe.png' },
  { id: 'paper_fan', name: 'Paper Fan', type: 'weapon', biome: 'desert', attack: 3, hit: 3, img: 'paper_fan.png' },
  { id: 'banana_slingshot', name: 'Banana Slingshot', type: 'weapon', biome: 'desert', attack: 4, hit: 4, img: 'banana_slingshot.png' },
  { id: 'red_licorice_whip', name: 'Red Licorice Whip', type: 'weapon', biome: 'desert', attack: 3, hit: 5, img: 'red_licorice_whip.png' },
  { id: 'mallow_catapult', name: 'Mallow Catapult', type: 'weapon', biome: 'desert', attack: 4, hit: 3, img: 'mallow_catapult.png' },
  { id: 'fart_bomb', name: 'Fart Bomb', type: 'weapon', biome: 'desert', attack: 3, hit: 4, img: 'fart_bomb.png' },
  { id: 'pogo_stick_lance', name: 'Pogo Stick Lance', type: 'weapon', biome: 'desert', attack: 4, hit: 5, img: 'pogo_stick_lance.png' },
  { id: 'jesters_scepter', name: "Jester's Scepter", type: 'weapon', biome: 'desert', attack: 3, hit: 4, img: "jesters_scepter.png" },
  { id: 'jelly_bean_gun', name: 'Jelly Bean Gun', type: 'weapon', biome: 'desert', attack: 4, hit: 3, img: 'jelly_bean_gun.png' },
  { id: 'plunger_bow', name: 'Plunger Bow', type: 'weapon', biome: 'desert', attack: 3, hit: 5, img: 'plunger_bow.png' },
  { id: 'sharp_candy_cane', name: 'Sharp Candy Cane', type: 'weapon', biome: 'desert', attack: 4, hit: 4, img: 'sharp_candy_cane.png' },
  { id: 'glue_shooter', name: 'Glue Shooter', type: 'weapon', biome: 'desert', attack: 3, hit: 3, img: 'glue_shooter.png' },
  { id: 'baguette_sword', name: 'Baguette Sword', type: 'weapon', biome: 'desert', attack: 4, hit: 5, img: 'baguette_sword.png' },
  { id: 'rolling_pin_hammer', name: 'Rolling Pin Hammer', type: 'weapon', biome: 'desert', attack: 3, hit: 4, img: 'rolling_pin_hammer.png' },
  { id: 'exploding_ice_cream', name: 'Exploding Ice Cream', type: 'weapon', biome: 'desert', attack: 4, hit: 3, img: 'exploding_ice_cream.png' },
  // Medium Armor (desert)
  { id: 'ice_cream_armor', name: 'Ice Cream Armor', type: 'armor', biome: 'desert', defense: 3, block: 3, img: 'ice_cream_armor.png' },
  { id: 'knittted_armor', name: 'Knittted Armor', type: 'armor', biome: 'desert', defense: 4, block: 4, img: 'knittted_armor.png' },
  { id: 'kitty_crown', name: 'Kitty Crown', type: 'armor', biome: 'desert', defense: 3, block: 5, img: 'kitty_crown.png' },
  { id: 'fuzzy_armguards', name: 'Fuzzy Armguards', type: 'armor', biome: 'desert', defense: 4, block: 3, img: 'fuzzy_armguards.png' },
  { id: 'cow_leather_jacket', name: 'Cow Leather Jacket', type: 'armor', biome: 'desert', defense: 3, block: 4, img: 'cow_leather_jacket.png' },
  { id: 'honey_helmet', name: 'Honey Helmet', type: 'armor', biome: 'desert', defense: 4, block: 5, img: 'honey_helmet.png' },
  { id: 'vacuum_armor', name: 'Vacuum Armor', type: 'armor', biome: 'desert', defense: 3, block: 4, img: 'vacuum_armor.png' },
  { id: 'crystal_boots', name: 'Crystal Boots', type: 'armor', biome: 'desert', defense: 4, block: 3, img: 'crystal_boots.png' },
  { id: 'stained_glass_shield', name: 'Stained Glass Shield', type: 'armor', biome: 'desert', defense: 3, block: 5, img: 'stained_glass_shield.png' },
  { id: 'jesters_cap', name: "Jester's Cap", type: 'armor', biome: 'desert', defense: 4, block: 4, img: "jesters_cap.png" },
  { id: 'colorful_quilted_tunic', name: 'Colorful Quilted Tunic', type: 'armor', biome: 'desert', defense: 3, block: 3, img: 'colorful_quilted_tunic.png' },
  { id: 'feathered_boots', name: 'Feathered Boots', type: 'armor', biome: 'desert', defense: 4, block: 5, img: 'feathered_boots.png' },
  { id: 'bamboo_armor', name: 'Bamboo Armor', type: 'armor', biome: 'desert', defense: 3, block: 4, img: 'bamboo_armor.png' },
  { id: 'colander_helm', name: 'Colander Helm', type: 'armor', biome: 'desert', defense: 4, block: 3, img: 'colander_helm.png' },
  { id: 'fox_helmet', name: 'Fox Helmet', type: 'armor', biome: 'desert', defense: 3, block: 4, img: 'fox_helmet.png' },
  { id: 'metal_mittens', name: 'Metal Mittens', type: 'armor', biome: 'desert', defense: 4, block: 5, img: 'metal_mittens.png' },
  { id: 'snail_shell_helmet', name: 'Snail Shell Helmet', type: 'armor', biome: 'desert', defense: 3, block: 3, img: 'snail_shell_helmet.png' },
  { id: 'oven_armor', name: 'Oven Armor', type: 'armor', biome: 'desert', defense: 4, block: 4, img: 'oven_armor.png' },
  // Hard Weapons (volcano, cave)
  { id: 'exploding_pie', name: 'Exploding Pie', type: 'weapon', biome: 'volcano,cave', attack: 3, hit: 3, img: 'exploding_pie.png' },
  { id: 'flaming_tuba', name: 'Flaming Tuba', type: 'weapon', biome: 'volcano,cave', attack: 4, hit: 4, img: 'flaming_tuba.png' },
  { id: 'glass_hammer', name: 'Glass Hammer', type: 'weapon', biome: 'volcano,cave', attack: 5, hit: 5, img: 'glass_hammer.png' },
  { id: 'octopus_launcher', name: 'Octopus Launcher', type: 'weapon', biome: 'volcano,cave', attack: 3, hit: 4, img: 'octopus_launcher.png' },
  { id: 'gummy_bear_mace', name: 'Gummy Bear Mace', type: 'weapon', biome: 'volcano,cave', attack: 4, hit: 5, img: 'gummy_bear_mace.png' },
  { id: 'mud_shotgun', name: 'Mud Shotgun', type: 'weapon', biome: 'volcano,cave', attack: 5, hit: 3, img: 'mud_shotgun.png' },
  { id: 'whacky_wizard_staff', name: 'Whacky Wizard Staff', type: 'weapon', biome: 'volcano,cave', attack: 3, hit: 5, img: 'whacky_wizard_staff.png' },
  { id: 'bagpipe_cannon', name: 'Bagpipe Cannon', type: 'weapon', biome: 'volcano,cave', attack: 4, hit: 3, img: 'bagpipe_cannon.png' },
  { id: 'piranha_on_a_stick', name: 'Piranha on a Stick', type: 'weapon', biome: 'volcano,cave', attack: 5, hit: 4, img: 'piranha_on_a_stick.png' },
  { id: 'scorpion_tail_spear', name: 'Scorpion tail Spear', type: 'weapon', biome: 'volcano,cave', attack: 3, hit: 5, img: 'scorpion_tail_spear.png' },
  { id: 'box_of_tiny_lion', name: 'Box of Tiny Lion', type: 'weapon', biome: 'volcano,cave', attack: 4, hit: 3, img: 'box_of_tiny_lion.png' },
  { id: 'danger_noodle_whip', name: 'Danger Noodle Whip', type: 'weapon', biome: 'volcano,cave', attack: 5, hit: 4, img: 'danger_noodle_whip.png' },
  { id: 'giggle_daggers', name: 'Giggle Daggers', type: 'weapon', biome: 'volcano,cave', attack: 3, hit: 4, img: 'giggle_daggers.png' },
  { id: 'rubber_chicken_axe', name: 'Rubber Chicken Axe', type: 'weapon', biome: 'volcano,cave', attack: 4, hit: 5, img: 'rubber_chicken_axe.png' },
  { id: 'shark_head_hammer', name: 'Shark Head Hammer', type: 'weapon', biome: 'volcano,cave', attack: 5, hit: 5, img: 'shark_head_hammer.png' },
  { id: 'roaring_great_sword', name: 'Roaring Great Sword', type: 'weapon', biome: 'volcano,cave', attack: 3, hit: 3, img: 'roaring_great_sword.png' },
  { id: 'wild_whirl_scythe', name: 'Wild Whirl Scythe', type: 'weapon', biome: 'volcano,cave', attack: 4, hit: 4, img: 'wild_whirl_scythe.png' },
  { id: 'crazy_cat_launcher', name: 'Crazy Cat Launcher', type: 'weapon', biome: 'volcano,cave', attack: 5, hit: 5, img: 'crazy_cat_launcher.png' },
  // Hard Armor (volcano, cave)
  { id: 'wooden_buckler', name: 'Wooden Buckler', type: 'armor', biome: 'volcano,cave', defense: 3, block: 3, img: 'wooden_buckler.png' },
  { id: 'barrel_lid_shield', name: 'Barrel Lid Shield', type: 'armor', biome: 'volcano,cave', defense: 4, block: 4, img: 'barrel_lid_shield.png' },
  { id: 'feather_helmet', name: 'Feather Helmet', type: 'armor', biome: 'volcano,cave', defense: 5, block: 5, img: 'feather_helmet.png' },
  { id: 'plant_shield', name: 'Plant Shield', type: 'armor', biome: 'volcano,cave', defense: 3, block: 4, img: 'plant_shield.png' },
  { id: 'sturdy_fish_shield', name: 'Sturdy Fish Shield', type: 'armor', biome: 'volcano,cave', defense: 4, block: 5, img: 'sturdy_fish_shield.png' },
  { id: 'vortex_cape', name: 'Vortex Cape', type: 'armor', biome: 'volcano,cave', defense: 5, block: 3, img: 'vortex_cape.png' },
  { id: 'clock_shield', name: 'Clock Shield', type: 'armor', biome: 'volcano,cave', defense: 3, block: 5, img: 'clock_shield.png' },
  { id: 'spider_silk_gloves', name: 'Spider Silk Gloves', type: 'armor', biome: 'volcano,cave', defense: 4, block: 3, img: 'spider_silk_gloves.png' },
  { id: 'lightning_shield', name: 'Lightning Shield', type: 'armor', biome: 'volcano,cave', defense: 5, block: 4, img: 'lightning_shield.png' },
  { id: 'chicken_shield', name: 'Chicken Shield', type: 'armor', biome: 'volcano,cave', defense: 3, block: 5, img: 'chicken_shield.png' },
  { id: 'guardian_shield', name: 'Guardian Shield', type: 'armor', biome: 'volcano,cave', defense: 4, block: 3, img: 'guardian_shield.png' },
  { id: 'superhero_shield', name: 'Superhero Shield', type: 'armor', biome: 'volcano,cave', defense: 5, block: 4, img: 'superhero_shield.png' },
  { id: 'boulder_armor', name: 'Boulder Armor', type: 'armor', biome: 'volcano,cave', defense: 3, block: 4, img: 'boulder_armor.png' },
  { id: 'phoenix_cloak', name: 'Phoenix Cloak', type: 'armor', biome: 'volcano,cave', defense: 4, block: 5, img: 'phoenix_cloak.png' },
  { id: 'shark_armor', name: 'Shark Armor', type: 'armor', biome: 'volcano,cave', defense: 5, block: 3, img: 'shark_armor.png' },
  { id: 'serpent_scale', name: 'Serpent Scale', type: 'armor', biome: 'volcano,cave', defense: 3, block: 4, img: 'serpent_scale.png' },
  { id: 'dragon_scale_armor', name: 'Dragon Scale Armor', type: 'armor', biome: 'volcano,cave', defense: 4, block: 5, img: 'dragon_scale_armor.png' },
  { id: 'astral_plate_armor', name: 'Astral Plate Armor', type: 'armor', biome: 'volcano,cave', defense: 5, block: 5, img: 'astral_plate_armor.png' },
  // Items
  { id: 'teleport', name: 'Teleport', type: 'item', biome: 'any', effect: 'teleport', img: 'teleport.png' },
  { id: 'small_potion', name: 'Small Health Potion', type: 'item', biome: 'any', heal: 3, img: 'small_potion.png' },
  { id: 'medium_potion', name: 'Medium Health Potion', type: 'item', biome: 'any', heal: 5, img: 'medium_potion.png' },
  { id: 'large_potion', name: 'Large Health Potion', type: 'item', biome: 'any', heal: 7, img: 'large_potion.png' },
  { id: 'full_potion', name: 'Full Health Potion', type: 'item', biome: 'any', heal: 999, img: 'full_potion.png' },
  { id: 'extra_heart', name: 'Additional Heart', type: 'item', biome: 'any', effect: 'extra_heart', img: 'extra_heart.png' },
];

function getRandomItemForBiome(tilebiome) {
  // Only give biome-appropriate items (or biome:any), and not 'fist'
  const pool = ITEM_DEFS.filter(i => (i.biome === 'any' || (i.biome && i.biome.indexOf(tilebiome) !== -1)) && !i.noRandom);
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
}

// --- Biome grid generation ---
function generateBiomeGrid(width, height) {
  // Start with all plains
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => 'plains'));

  // Helper to place a patch of a biome
  function placePatch(biome, count, patchSize) {
    for (let i = 0; i < count; i++) {
      const cx = Math.floor(Math.random() * width);
      const cy = Math.floor(Math.random() * height);
      for (let dx = -patchSize; dx <= patchSize; dx++) {
        for (let dy = -patchSize; dy <= patchSize; dy++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < width && y >= 0 && y < height && Math.random() < 0.7) {
            grid[y][x] = biome;
          }
        }
      }
    }
  }

  // Place forest and desert patches
  placePatch('forest', Math.floor(width * height / 30), 2);
  placePatch('desert', Math.floor(width * height / 30), 2);

  // Place caves (single cells)
  for (let i = 0; i < Math.max(1, Math.floor(width * height / 100)); i++) {
    let x, y;
    do {
      x = Math.floor(Math.random() * width);
      y = Math.floor(Math.random() * height);
    } while (grid[y][x] !== 'plains');
    grid[y][x] = 'cave';
  }

  // Place castle in a random corner and surround with volcanoes
  const corners = [
    [0, 0],
    [0, height - 1],
    [width - 1, 0],
    [width - 1, height - 1]
  ];
  const [castleX, castleY] = corners[Math.floor(Math.random() * corners.length)];
  grid[castleY][castleX] = 'castle';
  // Surround castle with volcanoes
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const x = castleX + dx;
      const y = castleY + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        grid[y][x] = 'volcano';
      }
    }
  }

  // Place towns (single cells) at least 6 spaces from the castle
  let townsToPlace = Math.max(2, Math.floor(width * height / 80));
  let attempts = 0;
  const townCenters = [];
  while (townsToPlace > 0 && attempts < 1000) {
    let x = Math.floor(Math.random() * width);
    let y = Math.floor(Math.random() * height);
    // Manhattan distance from castle
    const dist = Math.abs(x - castleX) + Math.abs(y - castleY);
    if (
      grid[y][x] === 'plains' &&
      dist >= 6
    ) {
      grid[y][x] = 'town';
      townCenters.push({x, y});
      // Surround town with plains (unless castle or volcano)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            grid[ny][nx] = 'plains';
          }
        }
      }
      townsToPlace--;
    }
    attempts++;
  }
  // Attach townCenters to grid for player spawn logic
  grid._townCenters = townCenters;

  return grid;
}

// Create a new game
app.post('/api/games', (req, res) => {
  const { gridSizeX, gridSizeY } = req.body;
  const safeX = Math.max(10, Math.min(100, parseInt(gridSizeX) || 10));
  const safeY = Math.max(10, Math.min(100, parseInt(gridSizeY) || 10));
  const gameId = Math.random().toString(36).substr(2, 9);
  const biomeGrid = generateBiomeGrid(safeX, safeY);
  db.run('INSERT INTO games (id, gameStateJson) VALUES (?, ?)', [gameId, JSON.stringify({ currentTurn: 0, currentDiceRoll: null, gridSizeX: safeX, gridSizeY: safeY, biomeGrid })], err => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.status(201).json({ gameId });
  });
});

// Join an existing game
app.post('/api/games/:gameId/join', (req, res) => {
  const { gameId } = req.params;
  const { playerName } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (err) {
      console.error('DB error (games lookup):', err);
      return res.status(500).json({ error: 'DB error' });
    }
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const dir = path.join(process.cwd(), 'public', 'profile-pictures');
    fs.readdir(dir, (err, files) => {
      if (err) {
        console.error('Failed to list profile pictures:', err);
        return res.status(500).json({ error: 'Failed to list profile pictures' });
      }
      const allPics = files.filter(f => f.match(/\.(png|jpg|jpeg|gif)$/i));
      db.all('SELECT playerStateJson FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
        if (err) {
          console.error('DB error (players lookup):', err);
          return res.status(500).json({ error: 'DB error' });
        }
        // Remove already used pics
        const usedPics = playerRows.map(p => JSON.parse(p.playerStateJson).profilePic);
        const usedPositions = playerRows.map(p => {
          const ps = JSON.parse(p.playerStateJson);
          return ps && typeof ps.positionX === 'number' && typeof ps.positionY === 'number' ? `${ps.positionX},${ps.positionY}` : null;
        }).filter(Boolean);
        const availablePics = allPics.filter(pic => !usedPics.includes(pic));
        // Pick a random available pic, or fallback to 'default.png'
        const randomPic = availablePics.length > 0 ? availablePics[Math.floor(Math.random() * availablePics.length)] : 'default.png';
        db.get('SELECT * FROM players WHERE gameId = ? AND name = ?', [gameId, playerName], (err, playerRow) => {
          if (err) {
            console.error('DB error (players lookup):', err);
            return res.status(500).json({ error: 'DB error' });
          }
          if (playerRow) {
            return res.status(200).json({ playerId: playerRow.id });
          }
          const playerId = Math.random().toString(36).substr(2, 9);
          // --- Assign random position around a town not occupied by other players ---
          const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
          const gridSizeX = gameState.gridSizeX || 10;
          const gridSizeY = gameState.gridSizeY || 10;
          const biomeGrid = gameState.biomeGrid;
          let possiblePositions = [];
          let townCenters = biomeGrid && biomeGrid._townCenters ? biomeGrid._townCenters : null;
          if (!townCenters) {
            // fallback: find all towns
            townCenters = [];
            for (let y = 0; y < gridSizeY; y++) {
              for (let x = 0; x < gridSizeX; x++) {
                if (biomeGrid[y][x] === 'town') townCenters.push({x, y});
              }
            }
          }
          // Find all plains cells adjacent to a town
          for (const {x, y} of townCenters) {
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (
                  nx >= 0 && nx < gridSizeX && ny >= 0 && ny < gridSizeY &&
                  biomeGrid[ny][nx] === 'plains' &&
                  !usedPositions.includes(`${nx},${ny}`)
                ) {
                  possiblePositions.push({x: nx, y: ny});
                }
              }
            }
          }
          // fallback: any plains
          if (possiblePositions.length === 0) {
            for (let x = 0; x < gridSizeX; x++) {
              for (let y = 0; y < gridSizeY; y++) {
                if (biomeGrid[y][x] === 'plains' && !usedPositions.includes(`${x},${y}`)) {
                  possiblePositions.push({x, y});
                }
              }
            }
          }
          let positionX = 0, positionY = 0;
          if (possiblePositions.length > 0) {
            const pos = possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
            positionX = pos.x;
            positionY = pos.y;
          }
          const playerState = {
            positionX, positionY,
            maxHearts: 5,
            damage: 0,
            profilePic: randomPic,
            inventory: {
              weapons: ['fist'],
              armor: [],
              items: [],
              equippedWeaponId: 'fist',
              equippedArmorId: null
            }
          };
          db.run('INSERT INTO players (id, gameId, name, playerStateJson) VALUES (?, ?, ?, ?)', [playerId, gameId, playerName, JSON.stringify(playerState)], err2 => {
            if (err2) {
              console.error('DB error (insert player):', err2);
              return res.status(500).json({ error: 'DB error' });
            }
            res.status(200).json({ playerId });
          });
        });
      });
    });
  });
});

// Fetch game state
app.get('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
      db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
        res.json(serializeGame(gameRow, playerRows, validMoveRows));
      });
    });
  });
});

// Roll dice and return the number of spaces the player can move, plus valid moves
app.post('/api/games/:gameId/roll', (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
    const gridSizeX = gameState.gridSizeX || 10;
    const gridSizeY = gameState.gridSizeY || 10;
    db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
      const player = playerRows.find(p => p.id === playerId);
      if (!player) return res.status(404).json({ error: 'Player not found' });
      if (playerRows[gameState.currentTurn].id !== playerId)
        return res.status(400).json({ error: 'Not your turn' });
      if (gameState.currentDiceRoll)
        return res.status(400).json({ error: 'Dice already rolled for this turn' });
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      // Compute valid moves
      const playerState = player.playerStateJson ? JSON.parse(player.playerStateJson) : {};
      const moves = [];
      for (let dx = -diceRoll; dx <= diceRoll; dx++) {
        for (let dy = -diceRoll; dy <= diceRoll; dy++) {
          if (Math.abs(dx) + Math.abs(dy) <= diceRoll) {
            const x = playerState.positionX + dx;
            const y = playerState.positionY + dy;
            if (
              x >= 0 && x < gridSizeX && y >= 0 && y < gridSizeY &&
              !playerRows.some(p => {
                if (p.id === player.id) return false;
                const ps = p.playerStateJson ? JSON.parse(p.playerStateJson) : {};
                return ps.positionX === x && ps.positionY === y;
              })
            ) {
              moves.push({ x, y });
            }
          }
        }
      }
      gameState.currentDiceRoll = diceRoll;
      db.serialize(() => {
        db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
        db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
        const stmt = db.prepare('INSERT INTO valid_moves (gameId, x, y) VALUES (?, ?, ?)');
        for (const m of moves) stmt.run(gameId, m.x, m.y);
        stmt.finalize(() => {
          res.json({ diceRoll, validMoves: moves });
        });
      });
    });
  });
});

// Validate and process the player's move
app.post('/api/games/:gameId/move', (req, res) => {
  const { gameId } = req.params;
  const { playerId, targetX, targetY } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
    const gridSizeX = gameState.gridSizeX || 10;
    const gridSizeY = gameState.gridSizeY || 10;
    db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
      const player = playerRows.find(p => p.id === playerId);
      if (!player) return res.status(404).json({ error: 'Player not found' });
      if (playerRows[gameState.currentTurn].id !== playerId)
        return res.status(400).json({ error: 'Not your turn' });
      db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
        const isValid = validMoveRows.some(m => m.x === targetX && m.y === targetY);
        if (!isValid) return res.status(400).json({ error: 'Invalid move' });
        // Move player, advance turn, clear dice/valid_moves
        const nextTurn = (gameState.currentTurn + 1) % playerRows.length;
        // Update player state
        const playerState = player.playerStateJson ? JSON.parse(player.playerStateJson) : {};
        playerState.positionX = targetX;
        playerState.positionY = targetY;
        // --- Reduce health by 1 if moving onto cave biome ---
        const biome = gameState.biomeGrid?.[targetY]?.[targetX] || 'plains';
        if (biome === 'cave') {
          playerState.damage = Math.min((playerState.damage || 0) + 1, (playerState.maxHearts || 5) - 1);
        }
        // --- Gift a random item from the biome set ---
        let foundItem = null;
        if (biome !== 'town' && biome !== 'castle') { // Don't gift in towns/castle
          foundItem = getRandomItemForBiome(biome);
          if (foundItem) {
            // Add to inventory (by type)
            if (foundItem.type === 'weapon') {
              if (!playerState.inventory.weapons.includes(foundItem.id)) playerState.inventory.weapons.push(foundItem.id);
            } else if (foundItem.type === 'armor') {
              if (!playerState.inventory.armor.includes(foundItem.id)) playerState.inventory.armor.push(foundItem.id);
            } else if (foundItem.type === 'item') {
              playerState.inventory.items.push(foundItem.id);
            }
            // Add to game state for modal
            gameState.recentlyFoundItem = {
              playerId,
              item: foundItem,
              ts: Date.now()
            };
          }
        } else {
          gameState.recentlyFoundItem = null;
        }
        // Update game state
        gameState.currentTurn = nextTurn;
        gameState.currentDiceRoll = null;
        db.serialize(() => {
          db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [JSON.stringify(playerState), playerId]);
          db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
          db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
          // Return new state
          db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, newGameRow) => {
            db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, newPlayerRows) => {
              db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, newValidMoveRows) => {
                res.json({ success: true, gameState: serializeGame(newGameRow, newPlayerRows, newValidMoveRows) });
              });
            });
          });
        });
      });
    });
  });
});

// Fetch the latest game state
app.get('/api/games/:gameId/state', (req, res) => {
  const { gameId } = req.params;
  lastPoll[gameId] = Date.now();
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
      db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
        res.json(serializeGame(gameRow, playerRows, validMoveRows));
      });
    });
  });
});

// Reconnect a player to a game
app.post('/api/games/:gameId/reconnect', (req, res) => {
  const { gameId } = req.params;
  const { playerName } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    db.get('SELECT * FROM players WHERE gameId = ? AND name = ?', [gameId, playerName], (err, playerRow) => {
      if (!playerRow) return res.status(404).json({ error: 'Player not found' });
      db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
        db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
          res.json({ playerId: playerRow.id, gameState: serializeGame(gameRow, playerRows, validMoveRows) });
        });
      });
    });
  });
});

// Admin endpoint to list all games (requires password)
app.get('/api/admin/games', (req, res) => {
  const password = req.query.password;
  if (password !== 'superman') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.all('SELECT * FROM games', (err, gameRows) => {
    db.all('SELECT * FROM players', (err, playerRows) => {
      const allGames = gameRows.map(gameRow => ({
        gameId: gameRow.id,
        players: playerRows.filter(p => p.gameId === gameRow.id).map(p => ({ id: p.id, name: p.name })),
        currentTurn: playerRows.filter(p => p.gameId === gameRow.id)[gameRow.currentTurn]?.name || null,
        currentDiceRoll: gameRow.currentDiceRoll || null
      }));
      res.json(allGames);
    });
  });
});

// Admin endpoint to delete a game (requires password)
app.delete('/api/admin/games/:gameId', (req, res) => {
  const password = req.query.password;
  if (password !== 'superman') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { gameId } = req.params;
  db.run('DELETE FROM games WHERE id = ?', [gameId], err => {
    db.run('DELETE FROM players WHERE gameId = ?', [gameId]);
    db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
    res.json({ success: true });
  });
});

// Endpoint to list available profile pictures
app.get('/api/profile-pictures', (req, res) => {
  const dir = path.join(process.cwd(), 'public', 'profile-pictures');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to list profile pictures' });
    res.json(files.filter(f => f.match(/\.(png|jpg|jpeg|gif)$/i)));
  });
});

// Endpoint to update a player's profile picture
app.post('/api/games/:gameId/player/:playerId/profile-pic', (req, res) => {
  const { gameId, playerId } = req.params;
  const { profilePic } = req.body;
  db.get('SELECT * FROM players WHERE id = ? AND gameId = ?', [playerId, gameId], (err, playerRow) => {
    if (!playerRow) return res.status(404).json({ error: 'Player not found' });
    const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
    playerState.profilePic = profilePic;
    db.run('UPDATE players SET playerStateJson = ? WHERE id = ? AND gameId = ?', [JSON.stringify(playerState), playerId, gameId], err2 => {
      if (err2) return res.status(500).json({ error: 'Failed to update profile picture' });
      res.json({ success: true });
    });
  });
});

// Equip weapon or armor
app.post('/api/games/:gameId/player/:playerId/equip', (req, res) => {
  const { gameId, playerId } = req.params;
  const { itemId } = req.body;
  db.get('SELECT * FROM players WHERE id = ? AND gameId = ?', [playerId, gameId], (err, playerRow) => {
    if (!playerRow) return res.status(404).json({ error: 'Player not found' });
    const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
    const item = ITEM_DEFS.find(i => i.id === itemId);
    if (!item) return res.status(400).json({ error: 'Invalid item' });
    if (item.type === 'weapon' && playerState.inventory.weapons.includes(itemId)) {
      playerState.inventory.equippedWeaponId = itemId;
      // Add notification
      db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
        if (gameRow) {
          const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
          addRecentAction(gameState, 'equip', playerRow.name, item.name);
          db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId], () => {
            db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [JSON.stringify(playerState), playerId], err2 => {
              if (err2) return res.status(500).json({ error: 'Failed to equip item' });
              res.json({ success: true });
            });
          });
        }
      });
      return;
    } else if (item.type === 'armor' && playerState.inventory.armor.includes(itemId)) {
      playerState.inventory.equippedArmorId = itemId;
      // Add notification
      db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
        if (gameRow) {
          const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
          addRecentAction(gameState, 'equip', playerRow.name, item.name);
          db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId], () => {
            db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [JSON.stringify(playerState), playerId], err2 => {
              if (err2) return res.status(500).json({ error: 'Failed to equip item' });
              res.json({ success: true });
            });
          });
        }
      });
      return;
    } else {
      return res.status(400).json({ error: 'Item not in inventory' });
    }
  });
});

// Use item (e.g., potion, teleport, extra heart)
app.post('/api/games/:gameId/player/:playerId/use-item', (req, res) => {
  const { gameId, playerId } = req.params;
  const { itemId } = req.body;
  db.get('SELECT * FROM players WHERE id = ? AND gameId = ?', [playerId, gameId], (err, playerRow) => {
    if (!playerRow) return res.status(404).json({ error: 'Player not found' });
    const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
    if (!playerState.inventory.items.includes(itemId)) return res.status(400).json({ error: 'Item not in inventory' });
    const item = ITEM_DEFS.find(i => i.id === itemId);
    if (!item || item.type !== 'item') return res.status(400).json({ error: 'Invalid item' });
    // Apply item effect
    let used = false;
    if (item.heal) {
      playerState.damage = Math.max(0, (playerState.damage || 0) - item.heal);
      used = true;
    } else if (item.effect === 'full_heal') {
      playerState.damage = 0;
      used = true;
    } else if (item.effect === 'extra_heart') {
      playerState.maxHearts = Math.min((playerState.maxHearts || 5) + 1, 20);
      used = true;
    } else if (item.effect === 'teleport') {
      // Teleport to nearest town
      const gameState = playerRow.gameStateJson ? JSON.parse(playerRow.gameStateJson) : {};
      const biomeGrid = gameState.biomeGrid;
      if (biomeGrid) {
        let minDist = Infinity, tx = 0, ty = 0;
        for (let y = 0; y < biomeGrid.length; y++) {
          for (let x = 0; x < biomeGrid[0].length; x++) {
            if (biomeGrid[y][x] === 'town') {
              const dist = Math.abs(playerState.positionX - x) + Math.abs(playerState.positionY - y);
              if (dist < minDist) { minDist = dist; tx = x; ty = y; }
            }
          }
        }
        playerState.positionX = tx;
        playerState.positionY = ty;
        used = true;
      }
    }
    if (used) {
      // Remove item from inventory
      playerState.inventory.items = playerState.inventory.items.filter(i => i !== itemId);
      db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
        if (gameRow) {
          const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
          addRecentAction(gameState, 'use-item', playerRow.name, item.name);
          db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId], () => {
            db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [JSON.stringify(playerState), playerId], err2 => {
              if (err2) return res.status(500).json({ error: 'Failed to use item' });
              res.json({ success: true });
            });
          });
        }
      });
      return;
    } else {
      res.status(400).json({ error: 'Item cannot be used' });
    }
  });
});

// Periodically clean up inactive games (no poll in 60s)
setInterval(() => {
  const now = Date.now();
  db.all('SELECT id FROM games', (err, rows) => {
    if (rows) {
      for (const row of rows) {
        const gameId = row.id;
        if (!lastPoll[gameId] || now - lastPoll[gameId] > 60000) {
          db.run('DELETE FROM games WHERE id = ?', [gameId]);
          db.run('DELETE FROM players WHERE gameId = ?', [gameId]);
          db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
          delete lastPoll[gameId];
          console.log(`Game ${gameId} deleted due to inactivity.`);
        }
      }
    }
  });
}, 60000);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});