// TypeScript interfaces for game state, items, and player
export interface ItemMeta {
	id: string;
	name: string;
	img: string;
	type: 'weapon' | 'armor' | 'item';
	attack?: number;
	attackChance?: number;
	defense?: number;
	defenseChance?: number;
	heal?: number;
	effect?: string;
}

export interface Inventory {
	weapons: string[];
	armor: string[];
	items: string[];
	equippedWeaponId?: string;
	equippedArmorId?: string;
}

export interface Character {
	id: string;
	description: string;
}

export interface Player {
	id: string;
	name: string;
	characterId?: string; // new: character id
	maxHearts?: number;
	damage?: number;
	positionX: number;
	positionY: number;
	inventory: Inventory;
}

export interface RecentAction {
	id: string;
	type: string; // e.g. 'use-item', 'equip', 'battle-end', etc.
	playerName: string;
	itemName: string;
	ts: number;
}

export interface CurrentBattle {
	playerId: string;
	monster: MonsterMeta;
	playerHealth: number;
	monsterHealth: number;
	battleLog: string[];
	battleActive: boolean;
	biome: string;
	ts: number;
}

export interface RaidBossState {
	id: string;
	name: string;
	maxHealth: number;
	currentHealth: number;
	attack: number;
	attackChance: number;
	defense: number;
	defenseChance: number;
	img: string;
	defeated: boolean;
	defeatedByPlayerId?: string;
	defeatedByPlayerName?: string;
	defeatedAtTs?: number;
}

export interface GameCompletionState {
	completed: boolean;
	reason?: string;
	completedByPlayerId?: string;
	completedByPlayerName?: string;
	completedAtTs?: number;
}

export interface MonsterMeta {
	id: string;
	name: string;
	biome: string;
	health: number;
	attack: number;
	attackChance: number;
	defense: number;
	defenseChance: number;
	img: string;
}

export interface RecentlyFoundItem {
	playerId: string;
	item: ItemMeta;
	ts: number;
}

export interface GameState {
	gameId: string;
	gridSizeX: number;
	gridSizeY: number;
	players: Player[];
	currentTurn: number;
	currentDiceRoll?: number;
	validMoves?: { x: number; y: number }[];
	biomeGrid?: string[][];
	itemMeta?: Record<string, ItemMeta>;
	recentlyFoundItem?: RecentlyFoundItem;
	currentBattle?: CurrentBattle;
	recentActions?: RecentAction[];
	raidBoss?: RaidBossState;
	gameCompletion?: GameCompletionState;
}

export interface AdminGame {
	gameId: string;
	players: { id: string; name: string }[];
	currentTurn: string | null;
	currentDiceRoll: number | null;
	preventExpiry: boolean;
}

export interface AdminItem {
	group: string;
	groupLabel?: string;
	id: string;
	name: string;
	type: 'weapon' | 'armor' | 'item';
	variant?: string | null;
	baseId?: string | null;
}
