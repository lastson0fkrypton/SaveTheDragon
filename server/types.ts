export type ItemType = 'weapon' | 'armor' | 'item';

export interface ItemDef {
	id: string;
	name: string;
	type: ItemType;
	biome?: string;
	attack?: number | null;
	attackChance?: number | null;
	defense?: number | null;
	defenseChance?: number | null;
	heal?: number | null;
	effect?: string | null;
	img?: string | null;
	noRandom?: boolean | null;
}

export interface MonsterDef {
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

export interface Inventory {
	weapons: string[];
	armor: string[];
	items: string[];
	equippedWeaponId?: string | null;
	equippedArmorId?: string | null;
}

export interface PlayerState {
	positionX: number;
	positionY: number;
	maxHearts: number;
	damage: number;
	characterId: string;
	inventory: Inventory;
}

export interface BattleState {
	playerId: string;
	monster: MonsterDef;
	playerHealth: number;
	monsterHealth: number;
	battleLog: string[];
	battleActive: boolean;
	biome: string;
	ts: number;
}

export interface RecentAction {
	id: string;
	type: string;
	playerName: string;
	itemName: string;
	ts: number;
}

export interface RecentlyFoundItem {
	playerId: string;
	item: ItemDef | null;
	ts: number;
}

export interface TownCenter {
	x: number;
	y: number;
}

export type BiomeGrid = (string[][] & { _townCenters?: TownCenter[] });

export interface GameStateJson {
	currentTurn: number;
	currentDiceRoll: number | null;
	gridSizeX: number;
	gridSizeY: number;
	biomeGrid: BiomeGrid;
	recentlyFoundItem?: RecentlyFoundItem | null;
	currentBattle?: BattleState | null;
	recentActions?: RecentAction[];
}

export interface GameRow {
	id: string;
	gameStateJson: string;
	currentTurn?: number;
	currentDiceRoll?: number | null;
}

export interface PlayerRow {
	id: string;
	gameId: string;
	name: string;
	playerStateJson: string;
}

export interface PlayerStateRow {
	playerStateJson: string;
}

export interface ValidMoveRow {
	gameId: string;
	x: number;
	y: number;
}

export interface ServiceError extends Error {
	status: number;
}
