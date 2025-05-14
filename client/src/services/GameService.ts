import AppStore from '../stores/AppState';
import type { GameState } from '../types';

class GameService {
  store: AppStore;
  constructor(store: AppStore) {
    this.store = store;
  }

  //admin API methods
  async fetchAdminGames(pw: string) {
    this.store.setAdminError('');
    const res = await fetch(`/api/admin/games?password=${encodeURIComponent(pw)}`);
    if (!res.ok) {
      this.store.setAdminError('Incorrect password or forbidden');
      return;
    }
    this.store.setAdminLoggedIn(true);
    this.store.setAdminPassword(pw);
    this.store.setAdminGames(await res.json());
  };
  async deleteAdminGame(gameId: string, password: string) {
    await fetch(`/api/admin/games/${gameId}?password=${encodeURIComponent(password)}`, { method: 'DELETE' });
  }

  //game management API methods
  async createGame(playerName: string, gridSizeX: number, gridSizeY: number) {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gridSizeX, gridSizeY })
    });
    const data = await res.json();
    const gid = data.gameId;
    const joinRes = await fetch(`/api/games/${gid}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName })
    });
    const joinData = await joinRes.json();
    this.store.setPlayerId(joinData.playerId);
    this.store.setGameId(gid);
  }

  async joinGame(gameId: string, playerName: string) {
    const joinRes = await fetch(`/api/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName })
    });
    const joinData = await joinRes.json();
    this.store.setPlayerId(joinData.playerId);
    this.store.setGameId(gameId);
  }

  //game API Methods
  async fetchGameState(gameId: string): Promise<GameState | null> {
    const res = await fetch(`/api/games/${gameId}/state`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  }

  async fetchProfilePics() {
    const res = await fetch('/api/profile-pictures');
    if (res.ok) {
      return await res.json();
    }
    return [];
  }
  
  async rollDice() {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: this.store.playerId }),
    });

    if (!response.ok) {
      console.error('Failed to roll dice');
    }
  }

  // Move player to a new position
  async movePlayer(x: number, y: number) {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: this.store.playerId, targetX: x, targetY: y }),
    });
    if (!response.ok) {
      console.error('Failed to move player');
    }
  }

  // Use an item from inventory
  async useItem(itemId: string) {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/use-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: this.store.playerId, itemId }),
    });
    if (!response.ok) {
      console.error('Failed to use item');
    }
  }

  // Equip a weapon or armor
  async equipItem(itemId: string, type: 'weapon' | 'armor') {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/player/${this.store.playerId}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, type }),
    });
    if (!response.ok) {
      console.error('Failed to equip item');
    }
  }

  // Update profile picture
  async updateProfilePic(profilePic: string) {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/player/${this.store.playerId}/profile-pic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: this.store.playerId, profilePic }),
    });
    if (!response.ok) {
      console.error('Failed to update profile picture');
    }
  }

  // Battle API methods
  async attack() {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/battle/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: this.store.playerId }),
    });
    if (!response.ok) {
      console.error('Failed to attack');
    }
  }

  async run() {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/battle/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: this.store.playerId }),
    });
    if (!response.ok) {
      console.error('Failed to run away');
    }
  }

  async collectLoot() {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/battle/collect-loot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: this.store.playerId }),
    });
    if (!response.ok) {
      console.error('Failed to collect loot');
    }
  }

  async returnToTown() {
    if (!this.store.gameId || !this.store.playerId) return;
    const response = await fetch(`/api/games/${this.store.gameId}/battle/return-to-town`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: this.store.playerId }),
    });
    if (!response.ok) {
      console.error('Failed to return to town');
    }
  }
}

export default GameService;
