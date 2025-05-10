import AppStore from '../stores/AppState';
import type { GameState } from '../types';

class GameService {
  store: AppStore;
  constructor(store: AppStore) {
    this.store = store;
  }

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

  async fetchGameState(gameId: string): Promise<GameState | null> {
    const res = await fetch(`/api/games/${gameId}/state`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  }
}

export default GameService;
