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
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type, // 'use-item' or 'equip'
    playerName,
    itemName,
    ts: Date.now()
  };
  gameState.recentActions.push(action);
  // Keep only the latest 10 actions
  if (gameState.recentActions.length > 10) gameState.recentActions = gameState.recentActions.slice(-10);
}

const PROFILE_PICTURES = [
  'brave_knight.png',
  'clever_rogue.png',
  'firey_princess.png',
  'intelligent_wizard.png',
  'unicorn_knight.png',
  'unicorn_warrior.png',
  'war_shark.png'
]

// --- Item definitions ---
const ITEM_DEFS = [
  // Fist (starter, not random)
  { id: 'fist', name: 'Fist', type: 'weapon', biome: 'any', attack: 1, attackChance: 0.5, img: 'fist.png', noRandom: true },
  // Easy Weapons (plains, forest)
  { id: 'rusty_spoon', name: 'Rusty Spoon', type: 'weapon', biome: 'plains,forest', attack: 1, attackChance: 0.5, img: 'rusty_spoon.png' },
  { id: 'foam_noodle', name: 'Foam Noodle', type: 'weapon', biome: 'plains,forest', attack: 1, attackChance: 0.7, img: 'foam_noodle.png' },
  { id: 'rubber_chicken', name: 'Rubber Chicken', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.9, img: 'rubber_chicken.png' },
  { id: 'feather_duster', name: 'Feather Duster', type: 'weapon', biome: 'plains,forest', attack: 1, attackChance: 0.7, img: 'feather_duster.png' },
  { id: 'banana_boomerang', name: 'Banana Boomerang', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.5, img: 'banana_boomerang.png' },
  { id: 'bubble_wrap_sword', name: 'Bubble Wrap Sword', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.9, img: 'bubble_wrap_sword.png' },
  { id: 'bubble_wand', name: 'Bubble Wand', type: 'weapon', biome: 'plains,forest', attack: 1, attackChance: 0.5, img: 'bubble_wand.png' },
  { id: 'squirt_gun_blaster', name: 'Squirt Gun Blaster', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.7, img: 'squirt_gun_blaster.png' },
  { id: 'balloon_sword', name: 'Balloon Sword', type: 'weapon', biome: 'plains,forest', attack: 1, attackChance: 0.9, img: 'balloon_sword.png' },
  { id: 'spaghetti_whip', name: 'Spaghetti Whip', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.5, img: 'spaghetti_whip.png' },
  { id: 'silly_string_shooter', name: 'Silly String Shooter', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.7, img: 'silly_string_shooter.png' },
  { id: 'cucumber_sword', name: 'Cucumber Sword', type: 'weapon', biome: 'plains,forest', attack: 1, attackChance: 0.9, img: 'cucumber_sword.png' },
  { id: 'clown_nose_launcher', name: 'Clown Nose Launcher', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.5, img: 'clown_nose_launcher.png' },
  { id: 'balloon_launcher', name: 'Balloon Launcher', type: 'weapon', biome: 'plains,forest', attack: 1, attackChance: 0.7, img: 'balloon_launcher.png' },
  { id: 'sausage_nunchucks', name: 'Sausage Nunchucks', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.9, img: 'sausage_nunchucks.png' },
  { id: 'bouncy_ball_blaster', name: 'Bouncy Ball Blaster', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.5, img: 'bouncy_ball_blaster.png' },
  { id: 'sock_with_a_rock', name: 'Sock with a Rock', type: 'weapon', biome: 'plains,forest', attack: 2, attackChance: 0.7, img: 'sock_with_a_rock.png' },
  { id: 'pooper_scooper', name: 'Pooper Scooper', type: 'weapon', biome: 'plains,forest', attack: 1, attackChance: 0.9, img: 'pooper_scooper.png' },
  // Easy Armor (plains, forest)
  { id: 'rubber_bracelet', name: 'Rubber Bracelet', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.5, img: 'rubber_bracelet.png' },
  { id: 'popstick_shield', name: 'Popstick Shield', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.7, img: 'popstick_shield.png' },
  { id: 'straw_hat', name: 'Straw Hat', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.9, img: 'straw_hat.png' },
  { id: 'dog_collar_armbands', name: 'Dog Collar Armbands', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.5, img: 'dog_collar_armbands.png' },
  { id: 'cardboard_gloves', name: 'Cardboard Gloves', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.7, img: 'cardboard_gloves.png' },
  { id: 'steel_toeless_boots', name: 'Steel Toeless Boots', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.9, img: 'steel_toeless_boots.png' },
  { id: 'tin_foil_shield', name: 'Tin Foil Shield', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.5, img: 'tin_foil_shield.png' },
  { id: 'fuzzy_slippers', name: 'Fuzzy Slippers', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.7, img: 'fuzzy_slippers.png' },
  { id: 'leather_undies', name: 'Leather Undies', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.9, img: 'leather_undies.png' },
  { id: 'pizza_boots', name: 'Pizza Boots', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.5, img: 'pizza_boots.png' },
  { id: 'jello_helmet', name: 'Jello Helmet', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.7, img: 'jello_helmet.png' },
  { id: 'cardboard_chestplate', name: 'Cardboard Chestplate', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.9, img: 'cardboard_chestplate.png' },
  { id: 'bubble_wrap_armor', name: 'Bubble Wrap Armor', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.5, img: 'bubble_wrap_armor.png' },
  { id: 'booger_crown', name: 'Booger Crown', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.7, img: 'booger_crown.png' },
  { id: 'cloud_gloves', name: 'Cloud Gloves', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.9, img: 'cloud_gloves.png' },
  { id: 'toilet_seat_shield', name: 'Toilet Seat Shield', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.5, img: 'toilet_seat_shield.png' },
  { id: 'patchwork_poncho', name: 'Patchwork Poncho', type: 'armor', biome: 'plains,forest', defense: 1, defenseChance: 0.7, img: 'patchwork_poncho.png' },
  { id: 'caterpillar_helmet', name: 'Caterpillar Helmet', type: 'armor', biome: 'plains,forest', defense: 2, defenseChance: 0.9, img: 'caterpillar_helmet.png' },
  // Medium Weapons (desert)
  { id: 'cola_bomb', name: 'Cola Bomb', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.5, img: 'cola_bomb.png' },
  { id: 'feather_boomerang', name: 'Feather Boomerang', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.7, img: 'feather_boomerang.png' },
  { id: 'confetti_cannon', name: 'Confetti Cannon', type: 'weapon', biome: 'desert', attack: 4, attackChance: 0.9, img: 'confetti_cannon.png' },
  { id: 'spitwad_blowpipe', name: 'Spitwad Blowpipe', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.9, img: 'spitwad_blowpipe.png' },
  { id: 'paper_fan', name: 'Paper Fan', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.5, img: 'paper_fan.png' },
  { id: 'banana_slingshot', name: 'Banana Slingshot', type: 'weapon', biome: 'desert', attack: 4, attackChance: 0.7, img: 'banana_slingshot.png' },
  { id: 'red_licorice_whip', name: 'Red Licorice Whip', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.9, img: 'red_licorice_whip.png' },
  { id: 'mallow_catapult', name: 'Mallow Catapult', type: 'weapon', biome: 'desert', attack: 4, attackChance: 0.5, img: 'mallow_catapult.png' },
  { id: 'fart_bomb', name: 'Fart Bomb', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.7, img: 'fart_bomb.png' },
  { id: 'pogo_stick_lance', name: 'Pogo Stick Lance', type: 'weapon', biome: 'desert', attack: 4, attackChance: 0.9, img: 'pogo_stick_lance.png' },
  { id: 'jesters_scepter', name: "Jester's Scepter", type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.7, img: "jesters_scepter.png" },
  { id: 'jelly_bean_gun', name: 'Jelly Bean Gun', type: 'weapon', biome: 'desert', attack: 4, attackChance: 0.5, img: 'jelly_bean_gun.png' },
  { id: 'plunger_bow', name: 'Plunger Bow', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.9, img: 'plunger_bow.png' },
  { id: 'sharp_candy_cane', name: 'Sharp Candy Cane', type: 'weapon', biome: 'desert', attack: 4, attackChance: 0.7, img: 'sharp_candy_cane.png' },
  { id: 'glue_shooter', name: 'Glue Shooter', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.5, img: 'glue_shooter.png' },
  { id: 'baguette_sword', name: 'Baguette Sword', type: 'weapon', biome: 'desert', attack: 4, attackChance: 0.9, img: 'baguette_sword.png' },
  { id: 'rolling_pin_hammer', name: 'Rolling Pin Hammer', type: 'weapon', biome: 'desert', attack: 3, attackChance: 0.7, img: 'rolling_pin_hammer.png' },
  { id: 'exploding_ice_cream', name: 'Exploding Ice Cream', type: 'weapon', biome: 'desert', attack: 4, attackChance: 0.5, img: 'exploding_ice_cream.png' },
  // Medium Armor (desert)
  { id: 'ice_cream_armor', name: 'Ice Cream Armor', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.5, img: 'ice_cream_armor.png' },
  { id: 'knittted_armor', name: 'Knittted Armor', type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.7, img: 'knittted_armor.png' },
  { id: 'kitty_crown', name: 'Kitty Crown', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.9, img: 'kitty_crown.png' },
  { id: 'fuzzy_armguards', name: 'Fuzzy Armguards', type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.5, img: 'fuzzy_armguards.png' },
  { id: 'cow_leather_jacket', name: 'Cow Leather Jacket', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.7, img: 'cow_leather_jacket.png' },
  { id: 'honey_helmet', name: 'Honey Helmet', type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.9, img: 'honey_helmet.png' },
  { id: 'vacuum_armor', name: 'Vacuum Armor', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.7, img: 'vacuum_armor.png' },
  { id: 'crystal_boots', name: 'Crystal Boots', type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.5, img: 'crystal_boots.png' },
  { id: 'stained_glass_shield', name: 'Stained Glass Shield', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.9, img: 'stained_glass_shield.png' },
  { id: 'jesters_cap', name: "Jester's Cap", type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.7, img: "jesters_cap.png" },
  { id: 'colorful_quilted_tunic', name: 'Colorful Quilted Tunic', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.5, img: 'colorful_quilted_tunic.png' },
  { id: 'feathered_boots', name: 'Feathered Boots', type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.9, img: 'feathered_boots.png' },
  { id: 'bamboo_armor', name: 'Bamboo Armor', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.7, img: 'bamboo_armor.png' },
  { id: 'colander_helm', name: 'Colander Helm', type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.5, img: 'colander_helm.png' },
  { id: 'fox_helmet', name: 'Fox Helmet', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.7, img: 'fox_helmet.png' },
  { id: 'metal_mittens', name: 'Metal Mittens', type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.9, img: 'metal_mittens.png' },
  { id: 'snail_shell_helmet', name: 'Snail Shell Helmet', type: 'armor', biome: 'desert', defense: 3, defenseChance: 0.5, img: 'snail_shell_helmet.png' },
  { id: 'oven_armor', name: 'Oven Armor', type: 'armor', biome: 'desert', defense: 4, defenseChance: 0.7, img: 'oven_armor.png' },
  // Hard Weapons (volcano, cave)
  { id: 'exploding_pie', name: 'Exploding Pie', type: 'weapon', biome: 'volcano,cave', attack: 3, attackChance: 0.5, img: 'exploding_pie.png' },
  { id: 'flaming_tuba', name: 'Flaming Tuba', type: 'weapon', biome: 'volcano,cave', attack: 4, attackChance: 0.7, img: 'flaming_tuba.png' },
  { id: 'glass_hammer', name: 'Glass Hammer', type: 'weapon', biome: 'volcano,cave', attack: 5, attackChance: 0.9, img: 'glass_hammer.png' },
  { id: 'octopus_launcher', name: 'Octopus Launcher', type: 'weapon', biome: 'volcano,cave', attack: 3, attackChance: 0.7, img: 'octopus_launcher.png' },
  { id: 'gummy_bear_mace', name: 'Gummy Bear Mace', type: 'weapon', biome: 'volcano,cave', attack: 4, attackChance: 0.9, img: 'gummy_bear_mace.png' },
  { id: 'mud_shotgun', name: 'Mud Shotgun', type: 'weapon', biome: 'volcano,cave', attack: 5, attackChance: 0.5, img: 'mud_shotgun.png' },
  { id: 'whacky_wizard_staff', name: 'Whacky Wizard Staff', type: 'weapon', biome: 'volcano,cave', attack: 3, attackChance: 0.9, img: 'whacky_wizard_staff.png' },
  { id: 'bagpipe_cannon', name: 'Bagpipe Cannon', type: 'weapon', biome: 'volcano,cave', attack: 4, attackChance: 0.7, img: 'bagpipe_cannon.png' },
  { id: 'piranha_on_a_stick', name: 'Piranha on a Stick', type: 'weapon', biome: 'volcano,cave', attack: 5, attackChance: 0.7, img: 'piranha_on_a_stick.png' },
  { id: 'scorpion_tail_spear', name: 'Scorpion tail Spear', type: 'weapon', biome: 'volcano,cave', attack: 3, attackChance: 0.9, img: 'scorpion_tail_spear.png' },
  { id: 'box_of_tiny_lion', name: 'Box of Tiny Lion', type: 'weapon', biome: 'volcano,cave', attack: 4, attackChance: 0.7, img: 'box_of_tiny_lion.png' },
  { id: 'danger_noodle_whip', name: 'Danger Noodle Whip', type: 'weapon', biome: 'volcano,cave', attack: 5, attackChance: 0.9, img: 'danger_noodle_whip.png' },
  { id: 'giggle_daggers', name: 'Giggle Daggers', type: 'weapon', biome: 'volcano,cave', attack: 3, attackChance: 0.7, img: 'giggle_daggers.png' },
  { id: 'rubber_chicken_axe', name: 'Rubber Chicken Axe', type: 'weapon', biome: 'volcano,cave', attack: 4, attackChance: 0.9, img: 'rubber_chicken_axe.png' },
  { id: 'shark_head_hammer', name: 'Shark Head Hammer', type: 'weapon', biome: 'volcano,cave', attack: 5, attackChance: 0.9, img: 'shark_head_hammer.png' },
  { id: 'roaring_great_sword', name: 'Roaring Great Sword', type: 'weapon', biome: 'volcano,cave', attack: 3, attackChance: 0.5, img: 'roaring_great_sword.png' },
  { id: 'wild_whirl_scythe', name: 'Wild Whirl Scythe', type: 'weapon', biome: 'volcano,cave', attack: 4, attackChance: 0.7, img: 'wild_whirl_scythe.png' },
  { id: 'crazy_cat_launcher', name: 'Crazy Cat Launcher', type: 'weapon', biome: 'volcano,cave', attack: 5, attackChance: 0.9, img: 'crazy_cat_launcher.png' },
  // Hard Armor (volcano, cave)
  { id: 'wooden_buckler', name: 'Wooden Buckler', type: 'armor', biome: 'volcano,cave', defense: 3, defenseChance: 0.5, img: 'wooden_buckler.png' },
  { id: 'barrel_lid_shield', name: 'Barrel Lid Shield', type: 'armor', biome: 'volcano,cave', defense: 4, defenseChance: 0.7, img: 'barrel_lid_shield.png' },
  { id: 'feather_helmet', name: 'Feather Helmet', type: 'armor', biome: 'volcano,cave', defense: 5, defenseChance: 0.9, img: 'feather_helmet.png' },
  { id: 'plant_shield', name: 'Plant Shield', type: 'armor', biome: 'volcano,cave', defense: 3, defenseChance: 0.7, img: 'plant_shield.png' },
  { id: 'sturdy_fish_shield', name: 'Sturdy Fish Shield', type: 'armor', biome: 'volcano,cave', defense: 4, defenseChance: 0.9, img: 'sturdy_fish_shield.png' },
  { id: 'vortex_cape', name: 'Vortex Cape', type: 'armor', biome: 'volcano,cave', defense: 5, defenseChance: 0.5, img: 'vortex_cape.png' },
  { id: 'clock_shield', name: 'Clock Shield', type: 'armor', biome: 'volcano,cave', defense: 3, defenseChance: 0.9, img: 'clock_shield.png' },
  { id: 'spider_silk_gloves', name: 'Spider Silk Gloves', type: 'armor', biome: 'volcano,cave', defense: 4, defenseChance: 0.7, img: 'spider_silk_gloves.png' },
  { id: 'lightning_shield', name: 'Lightning Shield', type: 'armor', biome: 'volcano,cave', defense: 5, defenseChance: 0.9, img: 'lightning_shield.png' },
  { id: 'chicken_shield', name: 'Chicken Shield', type: 'armor', biome: 'volcano,cave', defense: 3, defenseChance: 0.9, img: 'chicken_shield.png' },
  { id: 'guardian_shield', name: 'Guardian Shield', type: 'armor', biome: 'volcano,cave', defense: 4, defenseChance: 0.7, img: 'guardian_shield.png' },
  { id: 'superhero_shield', name: 'Superhero Shield', type: 'armor', biome: 'volcano,cave', defense: 5, defenseChance: 0.9, img: 'superhero_shield.png' },
  { id: 'boulder_armor', name: 'Boulder Armor', type: 'armor', biome: 'volcano,cave', defense: 3, defenseChance: 0.7, img: 'boulder_armor.png' },
  { id: 'phoenix_cloak', name: 'Phoenix Cloak', type: 'armor', biome: 'volcano,cave', defense: 4, defenseChance: 0.9, img: 'phoenix_cloak.png' },
  { id: 'shark_armor', name: 'Shark Armor', type: 'armor', biome: 'volcano,cave', defense: 5, defenseChance: 0.5, img: 'shark_armor.png' },
  { id: 'serpent_scale', name: 'Serpent Scale', type: 'armor', biome: 'volcano,cave', defense: 3, defenseChance: 0.7, img: 'serpent_scale.png' },
  { id: 'dragon_scale_armor', name: 'Dragon Scale Armor', type: 'armor', biome: 'volcano,cave', defense: 4, defenseChance: 0.9, img: 'dragon_scale_armor.png' },
  { id: 'astral_plate_armor', name: 'Astral Plate Armor', type: 'armor', biome: 'volcano,cave', defense: 5, defenseChance: 0.5, img: 'astral_plate_armor.png' },
  // Items
  { id: 'teleport', name: 'Teleport', type: 'item', biome: 'any', effect: 'teleport', img: 'teleport.png' },
  { id: 'small_potion', name: 'Small Health Potion', type: 'item', biome: 'any', heal: 3, img: 'small_potion.png' },
  { id: 'medium_potion', name: 'Medium Health Potion', type: 'item', biome: 'any', heal: 5, img: 'medium_potion.png' },
  { id: 'large_potion', name: 'Large Health Potion', type: 'item', biome: 'any', heal: 7, img: 'large_potion.png' },
  { id: 'full_potion', name: 'Full Health Potion', type: 'item', biome: 'any', heal: 999, img: 'full_potion.png' },
  { id: 'extra_heart', name: 'Additional Heart', type: 'item', biome: 'any', effect: 'extra_heart', img: 'extra_heart.png' },
];


// --- Monster definitions ---
const MONSTER_DEFS = [
  // Plains/Forest
  { id: 'weak_trollkin', name: 'Weak Trollkin', biome: 'plains,forest', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'trollkin.png' },
  { id: 'trollkin', name: 'Trollkin', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'trollkin.png' },
  { id: 'strong_trollkin', name: 'Strong Trollkin', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'trollkin.png' },
  { id: 'weak_bat', name: 'Weak Bat', biome: 'plains,forest', attack: 1, attackChance: 0.7, defense: 1, defenseChance: 0.33, img: 'bat.png' },
  { id: 'bat', name: 'Bat', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'bat.png' },
  { id: 'strong_bat', name: 'Strong Bat', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'bat.png' },
  { id: 'weak_fairy', name: 'Weak Fairy', biome: 'plains,forest', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'fairy.png' },
  { id: 'fairy', name: 'Fairy', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'fairy.png' },
  { id: 'strong_fairy', name: 'Strong Fairy', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'fairy.png' },
  { id: 'weak_black_cat', name: 'Weak Black Cat', biome: 'plains,forest', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'black_cat.png' },
  { id: 'black_cat', name: 'Black Cat', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'black_cat.png' },
  { id: 'strong_black_cat', name: 'Strong Black Cat', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'black_cat.png' },
  { id: 'weak_goblin', name: 'Weak Goblin', biome: 'plains,forest', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'goblin.png' },
  { id: 'goblin', name: 'Goblin', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'goblin.png' },
  { id: 'strong_goblin', name: 'Strong Goblin', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'goblin.png' },
  { id: 'weak_bigfoot', name: 'Weak Bigfoot', biome: 'plains,forest', attack: 1, attackChance: 0.7, defense: 1, defenseChance: 0.33, img: 'bigfoot.png' },
  { id: 'bigfoot', name: 'Bigfoot', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'bigfoot.png' },
  { id: 'strong_bigfoot', name: 'Strong Bigfoot', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'bigfoot.png' },
  { id: 'weak_giant_spider', name: 'Weak Giant Spider', biome: 'plains,forest', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'giant_spider.png' },
  { id: 'giant_spider', name: 'Giant Spider', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'giant_spider.png' },
  { id: 'strong_giant_spider', name: 'Strong Giant Spider', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'giant_spider.png' },
  { id: 'weak_ogre', name: 'Weak Ogre', biome: 'plains,forest', attack: 1, attackChance: 0.7, defense: 1, defenseChance: 0.33, img: 'ogre.png' },
  { id: 'ogre', name: 'Ogre', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'ogre.png' },
  { id: 'strong_ogre', name: 'Strong Ogre', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'ogre.png' },
  { id: 'weak_warewolf', name: 'Weak Warewolf', biome: 'plains,forest', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'warewolf.png' },
  { id: 'warewolf', name: 'Warewolf', biome: 'plains,forest', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'warewolf.png' },
  { id: 'strong_warewolf', name: 'Strong Warewolf', biome: 'plains,forest', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'warewolf.png' },
  // Desert
  { id: 'weak_spiky_lizard', name: 'Weak Spiky Lizard', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'spiky_lizard.png' },
  { id: 'spiky_lizard', name: 'Spiky Lizard', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'spiky_lizard.png' },
  { id: 'strong_spiky_lizard', name: 'Strong Spiky Lizard', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'spiky_lizard.png' },
  { id: 'weak_scorpion', name: 'Weak Scorpion', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'scorpion.png' },
  { id: 'scorpion', name: 'Scorpion', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'scorpion.png' },
  { id: 'strong_scorpion', name: 'Strong Scorpion', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'scorpion.png' },
  { id: 'weak_snake', name: 'Weak Snake', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'snake.png' },
  { id: 'snake', name: 'Snake', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'snake.png' },
  { id: 'strong_snake', name: 'Strong Snake', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'snake.png' },
  { id: 'weak_vulture', name: 'Weak Vulture', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'vulture.png' },
  { id: 'vulture', name: 'Vulture', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'vulture.png' },
  { id: 'strong_vulture', name: 'Strong Vulture', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'vulture.png' },
  { id: 'weak_harpy', name: 'Weak Harpy', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'harpy.png' },
  { id: 'harpy', name: 'Harpy', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'harpy.png' },
  { id: 'strong_harpy', name: 'Strong Harpy', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'harpy.png' },
  { id: 'weak_centaur', name: 'Weak Centaur', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'centaur.png' },
  { id: 'centaur', name: 'Centaur', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'centaur.png' },
  { id: 'strong_centaur', name: 'Strong Centaur', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'centaur.png' },
  { id: 'weak_sand_golem', name: 'Weak Sand Golem', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'sand_golem.png' },
  { id: 'sand_golem', name: 'Sand Golem', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'sand_golem.png' },
  { id: 'strong_sand_golem', name: 'Strong Sand Golem', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'sand_golem.png' },
  { id: 'weak_pheonix', name: 'Weak Pheonix', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'pheonix.png' },
  { id: 'pheonix', name: 'Pheonix', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'pheonix.png' },
  { id: 'strong_pheonix', name: 'Strong Pheonix', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'pheonix.png' },
  { id: 'weak_gryphon', name: 'Weak Gryphon', biome: 'desert', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'gryphon.png' },
  { id: 'gryphon', name: 'Gryphon', biome: 'desert', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'gryphon.png' },
  { id: 'strong_gryphon', name: 'Strong Gryphon', biome: 'desert', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'gryphon.png' },
  // Cave/Volcano
  { id: 'weak_fire_butterfly', name: 'Weak Fire Butterfly', biome: 'volcano,cave', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'fire_butterfly.png' },
  { id: 'fire_butterfly', name: 'Fire Butterfly', biome: 'volcano,cave', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'fire_butterfly.png' },
  { id: 'strong_fire_butterfly', name: 'Strong Fire Butterfly', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'fire_butterfly.png' },
  { id: 'weak_magma_cube', name: 'Weak Magma Cube', biome: 'volcano,cave', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'magma_cube.png' },
  { id: 'magma_cube', name: 'Magma Cube', biome: 'volcano,cave', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'magma_cube.png' },
  { id: 'strong_magma_cube', name: 'Strong Magma Cube', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'magma_cube.png' },
  { id: 'weak_ember_imp', name: 'Weak Ember Imp', biome: 'volcano,cave', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'ember_imp.png' },
  { id: 'ember_imp', name: 'Ember Imp', type: 'weapon', biome: 'volcano,cave', attack: 2, attackChance: 0.7, img: 'ember_imp.png' },
  { id: 'strong_ember_imp', name: 'Strong Ember Imp', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'ember_imp.png' },
  { id: 'weak_skeleton', name: 'Weak Skeleton', biome: 'volcano,cave', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'skeleton.png' },
  { id: 'skeleton', name: 'Skeleton', biome: 'volcano,cave', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'skeleton.png' },
  { id: 'strong_skeleton', name: 'Strong Skeleton', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'skeleton.png' },
  { id: 'weak_rock_troll', name: 'Weak Rock Troll', biome: 'volcano,cave', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'rock_troll.png' },
  { id: 'rock_troll', name: 'Rock Troll', biome: 'volcano,cave', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'rock_troll.png' },
  { id: 'strong_rock_troll', name: 'Strong Rock Troll', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'rock_troll.png' },
  { id: 'weak_medusa', name: 'Weak Medusa', biome: 'volcano,cave', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'medusa.png' },
  { id: 'medusa', name: 'Medusa', biome: 'volcano,cave', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'medusa.png' },
  { id: 'strong_medusa', name: 'Strong Medusa', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'medusa.png' },
  { id: 'weak_wizard', name: 'Weak Wizard', biome: 'volcano,cave', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'wizard.png' },
  { id: 'wizard', name: 'Wizard', biome: 'volcano,cave', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'wizard.png' },
  { id: 'strong_wizard', name: 'Strong Wizard', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'wizard.png' },
  { id: 'weak_red_dragon', name: 'Weak Red Dragon', biome: 'volcano,cave', attack: 1, attackChance: 0.7, defense: 1, defenseChance: 0.33, img: 'red_dragon.png' },
  { id: 'red_dragon', name: 'Red Dragon', biome: 'volcano,cave', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'red_dragon.png' },
  { id: 'strong_red_dragon', name: 'Strong Red Dragon', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'red_dragon.png' },
  { id: 'weak_dark_unicorn', name: 'Weak Dark Unicorn', biome: 'volcano,cave', attack: 1, attackChance: 0.5, defense: 1, defenseChance: 0.33, img: 'dark_unicorn.png' },
  { id: 'dark_unicorn', name: 'Dark Unicorn', biome: 'volcano,cave', attack: 2, attackChance: 0.7, defense: 2, defenseChance: 0.5, img: 'dark_unicorn.png' },
  { id: 'strong_dark_unicorn', name: 'Strong Dark Unicorn', biome: 'volcano,cave', attack: 3, attackChance: 0.9, defense: 3, defenseChance: 0.7, img: 'dark_unicorn.png' },
];

// --- Biome encounter rates ---
const BIOME_ENCOUNTER_RATES = {
  plains: 0.20,
  forest: 0.35,
  desert: 0.50,
  cave: 0.75,
  volcano: 0.75,
  castle: 0.0,
  town: 0.0
};


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
      townCenters.push({ x, y });
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
      const availablePics = PROFILE_PICTURES.filter(pic => !usedPics.includes(pic));
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
              if (biomeGrid[y][x] === 'town') townCenters.push({ x, y });
            }
          }
        }
        // Find all plains cells adjacent to a town
        for (const { x, y } of townCenters) {
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
                possiblePositions.push({ x: nx, y: ny });
              }
            }
          }
        }
        // fallback: any plains
        if (possiblePositions.length === 0) {
          for (let x = 0; x < gridSizeX; x++) {
            for (let y = 0; y < gridSizeY; y++) {
              if (biomeGrid[y][x] === 'plains' && !usedPositions.includes(`${x},${y}`)) {
                possiblePositions.push({ x, y });
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
        // Move player, clear dice/valid_moves
        // --- Only advance turn if no battle is encountered ---
        let advanceTurn = true;
        // Update player state
        const playerState = player.playerStateJson ? JSON.parse(player.playerStateJson) : {};
        playerState.positionX = targetX;
        playerState.positionY = targetY;
        // --- Reduce health by 1 if moving onto cave biome ---
        const biome = gameState.biomeGrid?.[targetY]?.[targetX] || 'plains';
        if (biome === 'town') {
          playerState.damage = 0;
        }
        // --- Remove gifting item on every move ---
        gameState.recentlyFoundItem = null;
        // --- Monster encounter logic ---
        let encounter = false;
        let encounteredMonster = null;
        // Only start a new battle if there is not already a battle for this player
        if (!gameState.currentBattle) {
          if (BIOME_ENCOUNTER_RATES[biome] > 0 && Math.random() < BIOME_ENCOUNTER_RATES[biome]) {
            // Find monsters for this biome
            const biomeMonsters = MONSTER_DEFS.filter(m => m.biome.split(',').includes(biome));
            if (biomeMonsters.length > 0) {
              encounter = true;
              encounteredMonster = biomeMonsters[Math.floor(Math.random() * biomeMonsters.length)];
              // Set battle state in gameState
              gameState.currentBattle = {
                playerId,
                monster: encounteredMonster,
                playerHealth: (playerState.maxHearts || 5) - (playerState.damage || 0),
                monsterHealth: encounteredMonster.defense * 2, // Monster health = 2x defense
                battleLog: [
                  `A wild ${encounteredMonster.name} appeared!`,
                  `Player: ${playerRows.find(p => p.id === playerId)?.name || 'Player'} vs ${encounteredMonster.name}`
                ],
                battleActive: true,
                ts: Date.now()
              };
              advanceTurn = false;
            }
          } else {
            gameState.currentBattle = null;
          }
        }
        // Only advance turn if no battle was started
        if (advanceTurn) {
          gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
        }
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

// --- BATTLE ENDPOINTS ---
// Player attacks monster
app.post('/api/games/:gameId/battle/attack', (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
    const battle = gameState.currentBattle;
    if (!battle || !battle.battleActive) return res.status(400).json({ error: 'No active battle' });
    if (battle.playerId !== playerId) return res.status(403).json({ error: 'Not your battle' });
    db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
      if (!playerRow) return res.status(404).json({ error: 'Player not found' });
      const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
      // Player attack
      const weaponId = playerState.inventory.equippedWeaponId || 'fist';
      const weapon = ITEM_DEFS.find(i => i.id === weaponId) || ITEM_DEFS.find(i => i.id === 'fist');
      let log = battle.battleLog || [];
      let playerHit = Math.random() < (weapon.attackChance || 0.5);
      let monsterBlock = Math.random() < (battle.monster.defenseChance || 0);
      let playerDmg = 0;
      if (playerHit) {
        playerDmg = weapon.attack || 1;
        if (monsterBlock) {
          playerDmg = Math.max(0, playerDmg - (battle.monster.defense || 0));
          log.push(`Monster blocks! Damage reduced.`);
        }
        battle.monsterHealth -= playerDmg;
        log.push(`Player attacks with ${weapon.name}: ${playerHit ? 'Hit' : 'Miss'}${playerDmg > 0 ? ` for ${playerDmg} damage!` : ''}`);
      } else {
        log.push(`Player attacks with ${weapon.name}: Miss!`);
      }
      // Check if monster defeated
      if (battle.monsterHealth <= 0) {
        log.push(`Monster ${battle.monster.name} defeated!`);
        battle.battleActive = false;
        // Do NOT clear currentBattle or advance turn here
      } else {
        // Monster attacks back if alive
        const armorId = playerState.inventory.equippedArmorId;
        const armor = armorId ? ITEM_DEFS.find(i => i.id === armorId) : null;
        let monsterHit = Math.random() < (battle.monster.attackChance || 0.5);
        let playerBlock = armor ? Math.random() < (armor.defenseChance || 0) : false;
        let monsterDmg = 0;
        if (monsterHit) {
          monsterDmg = battle.monster.attack || 1;
          if (playerBlock) {
            monsterDmg = Math.max(0, monsterDmg - (armor?.defense || 0));
            log.push(`Player blocks! Damage reduced.`);
          }
          battle.playerHealth -= monsterDmg;
          log.push(`Monster attacks: ${monsterHit ? 'Hit' : 'Miss'}${monsterDmg > 0 ? ` for ${monsterDmg} damage!` : ''}`);
        } else {
          log.push(`Monster attacks: Miss!`);
        }
        // Update player damage
        const maxHearts = playerState.maxHearts || 5;
        playerState.damage = Math.max(0, maxHearts - battle.playerHealth);
        // Check if player fainted
        if (battle.playerHealth <= 0) {
          battle.playerHealth = 0;
          log.push(`Player fainted due to injuries.`);
          battle.battleActive = false;
          // Do NOT clear currentBattle or advance turn here
        }
      }
      // Save state and return
      battle.battleLog = log;
      gameState.currentBattle = battle;
      db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [JSON.stringify(playerState), playerId], () => {
        db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId], () => {
          res.json({ success: true, battleLog: log, battleActive: battle.battleActive });
        });
      });
    });
  });
});

// Player runs away
app.post('/api/games/:gameId/battle/run', (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
    const battle = gameState.currentBattle;
    if (!battle || !battle.battleActive) return res.status(400).json({ error: 'No active battle' });
    if (battle.playerId !== playerId) return res.status(403).json({ error: 'Not your battle' });
    battle.battleActive = false;
    battle.battleLog.push('Player ran away! The battle is over.');
    // Add notification for all players
    if (!gameState.recentActions) gameState.recentActions = [];

    db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
      if (!playerRow) return res.status(404).json({ error: 'Player not found' });
      addRecentAction(gameState, 'battle-end', playerRow.name || 'Player', `ran away from ${battle.monster?.name || 'a monster'}`);

      // Advance turn and clear battle
      db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
        gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
        gameState.currentBattle = null;
        db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId], () => {
          res.json({ success: true, battleLog: battle.battleLog, ranAway: true });
        });
      });
    });
  });
});

// Player collects loot after winning
app.post('/api/games/:gameId/battle/collect-loot', (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
    const battle = gameState.currentBattle;
    // Only allow if player won (monsterHealth <= 0, playerHealth > 0, battleActive is false)
    if (!battle || battle.playerId !== playerId || battle.monsterHealth > 0 || battle.playerHealth <= 0 || battle.battleActive !== false) {
      return res.status(400).json({ error: 'Cannot collect loot unless you have won the battle.' });
    }
    db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
      if (!playerRow) return res.status(404).json({ error: 'Player not found' });
      const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
      // Reward item
      const biome = battle.monster.biome.split(',')[0];
      const reward = getRandomItemForBiome(biome);
      if (reward) {
        if (reward.type === 'weapon' && !playerState.inventory.weapons.includes(reward.id)) playerState.inventory.weapons.push(reward.id);
        else if (reward.type === 'armor' && !playerState.inventory.armor.includes(reward.id)) playerState.inventory.armor.push(reward.id);
        else if (reward.type === 'item') playerState.inventory.items.push(reward.id);
      }
      // Add to recentlyFoundItem for modal
      gameState.recentlyFoundItem = {
        playerId,
        item: reward,
        ts: Date.now()
      };
      // Add notification for all players
      addRecentAction(gameState, 'battle-end', playerRow.name, `defeated ${battle.monster?.name || 'a monster'}`);
      // Advance turn and clear battle
      gameState.currentBattle = null;
      db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
        gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
        db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [JSON.stringify(playerState), playerId], () => {
          db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId], () => {
            res.json({ success: true, reward });
          });
        });
      });
    });
  });
});

// Player returns to town after fainting (button for UI)
app.post('/api/games/:gameId/battle/return-to-town', (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;
  db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, playerRow) => {
    if (!playerRow) return res.status(404).json({ error: 'Player not found' });
    const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
    db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
      if (!gameRow) return res.status(404).json({ error: 'Game not found' });
      const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
      const battle = gameState.currentBattle;
      // Only allow if player lost (playerHealth <= 0, battleActive is false)
      if (!battle || battle.playerId !== playerId || battle.playerHealth > 0 || battle.battleActive !== false) {
        return res.status(400).json({ error: 'Cannot return to town unless you have lost the battle.' });
      }
      // Move player to nearest town
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
      }
      playerState.damage = 0;
      // Add notification for all players
      addRecentAction(gameState, 'battle-end', playerRow.name, 'returned to town after fainting');
      // Advance turn and clear battle
      gameState.currentBattle = null;
      db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
        gameState.currentTurn = (gameState.currentTurn + 1) % playerRows.length;
        db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [JSON.stringify(playerState), playerId], () => {
          db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId], () => {
            res.json({ success: true, returnedToTown: true });
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
  res.json(PROFILE_PICTURES);
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