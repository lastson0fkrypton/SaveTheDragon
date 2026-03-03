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

export interface QuestChecklistItem {
	label: string;
	checked: boolean;
}

export interface QuestOffer {
	id: string;
	title: string;
	description: string;
	rewardHearts: number;
	offeredAtTs: number;
	objectiveChecklist?: QuestChecklistItem[];
}

export interface QuestInstance {
	id: string;
	instanceId: string;
	title: string;
	description: string;
	rewardHearts: number;
	acceptedAtTs: number;
	completedAtTs?: number;
	progressLabel: string;
	progress: Record<string, unknown>;
	objectiveChecklist?: QuestChecklistItem[];
}

export interface PlayerQuestState {
	active: QuestInstance[];
	completed: QuestInstance[];
	pendingTownQuestPrompt: boolean;
	pendingQuestOffer: QuestOffer | null;
}

export interface QuestSystemState {
	deck: {
		drawPile: string[];
		discardPile: string[];
	};
	players: Record<string, PlayerQuestState>;
}

export interface MonsterMeta {
	id: string;
	name: string;
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
	questSystem?: QuestSystemState;
}

export interface AdminGame {
	gameId: string;
	players: AdminPlayerSummary[];
	currentTurn: string | null;
	currentDiceRoll: number | null;
	preventExpiry: boolean;
	deckSnapshots?: Record<string, AdminDeckSnapshot>;
	discardSnapshots?: Record<string, AdminDiscardSnapshot>;
}

export interface AdminDeckSnapshotCard {
	source: 'card' | 'consumable' | 'encounter-discard' | 'loot-discard';
	repeat: number;
	kind: 'monster' | 'item' | 'heart' | 'chest';
	id: string;
	name: string;
	variant?: string | null;
	type?: 'weapon' | 'armor' | 'item' | null;
	health?: number | null;
	attack?: number | null;
	attackChance?: number | null;
	defense?: number | null;
	defenseChance?: number | null;
	heal?: number | null;
	effect?: string | null;
	hearts?: number | null;
}

export interface AdminDeckSnapshot {
	deckId: string;
	explicitCount: number;
	consumableCount: number;
	totalCount: number;
	cards: AdminDeckSnapshotCard[];
}

export interface AdminPlayerOwnedCard {
	id: string;
	name: string;
	type: 'weapon' | 'armor' | 'item' | null;
	attack: number | null;
	attackChance: number | null;
	defense: number | null;
	defenseChance: number | null;
	heal: number | null;
	effect: string | null;
	equipped?: boolean;
}

export interface AdminPlayerSummary {
	id: string;
	name: string;
	equippedWeaponId?: string | null;
	equippedArmorId?: string | null;
	cards?: {
		weapons: AdminPlayerOwnedCard[];
		armor: AdminPlayerOwnedCard[];
		items: AdminPlayerOwnedCard[];
	};
}

export interface AdminDiscardSnapshot {
	deckId: string;
	encounterDiscardCount: number;
	lootDiscardCount: number;
	encounterDiscard: AdminDeckSnapshotCard[];
	lootDiscard: AdminDeckSnapshotCard[];
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
