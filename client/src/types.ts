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

export interface CharacterProfile {
  id: string;
  description: string;
}

export interface Player {
  id: string;
  name: string;
  profileId?: string; // new: character profile id
  maxHearts?: number;
  damage?: number;
  positionX: number;
  positionY: number;
  inventory: Inventory;
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
  recentlyFoundItem?: any;
  currentBattle?: any;
  recentActions?: any[];
}

export interface AdminGame {
  gameId: string;
  players: { id: string; name: string }[];
  currentTurn: string | null;
  currentDiceRoll: number | null;
}
