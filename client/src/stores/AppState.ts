import { useContext } from 'react';
import { makeAutoObservable } from 'mobx';
import { MobXProviderContext } from 'mobx-react';

import type { AdminGame, GameState } from '../types';
import GameService from '../services/GameService';

class AppState {
    service: GameService;
    
    // Admin state
    adminLoggedIn: boolean = false;
    adminPassword: string = '';
    adminError: string = '';
    adminGames: AdminGame[] = [];

    //game state
    playerId: string = '';
    gameId: string = '';
    gameState: GameState | null = null;
    
    constructor() {
        makeAutoObservable(this);
        this.service = new GameService(this);

        this.adminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        this.adminPassword = localStorage.getItem('adminPassword') || '';

        this.gameId = localStorage.getItem('gameId') || '';
        this.playerId = localStorage.getItem('playerId') || '';
    }

    //admin accessors
    setAdminLoggedIn(loggedIn: boolean) {
        this.adminLoggedIn = loggedIn;
        if (loggedIn)
            localStorage.setItem('adminLoggedIn', loggedIn.toString());
        else
            localStorage.removeItem('adminLoggedIn');
    }
    setAdminPassword(password: string) {
        this.adminPassword = password;
        if (password.length > 0)
            localStorage.setItem('adminPassword', password.toString());
        else 
            localStorage.removeItem('adminPassword');
    }
    setAdminError(error: string) {
        this.adminError = error;
    }
    setAdminGames(games: any[]) {
        this.adminGames = games;
    }
    
    //game accessors
    setPlayerId(id: string) {
        this.playerId = id;
        localStorage.setItem('playerId', id);
    }
    setGameId(id: string) {
        this.gameId = id;
        localStorage.setItem('gameId', id);
    }
    setGameState(state: GameState | null) {
        this.gameState = state;
    }
    reset() {
        this.playerId = '';
        this.gameId = '';
        this.gameState = null;
        localStorage.removeItem('playerId');
        localStorage.removeItem('gameId');
    }
}

export function getAppState(): AppState {
  const { state } = useContext(MobXProviderContext) as { state: AppState };
  if (!state) throw new Error('MobX state is not available in context');
  return state;
}

export default AppState;
