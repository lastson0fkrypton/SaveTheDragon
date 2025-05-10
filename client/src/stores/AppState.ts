import { makeAutoObservable, runInAction } from 'mobx';
import type { AdminGame, GameState } from '../types';
import GameService from '../services/GameService';

class AppState {
    playerId: string = '';
    gameId: string = '';
    gameState: GameState | null = null;
    loading: boolean = false;
    service: GameService;

    // Admin state
    adminLoggedIn: boolean = false;
    adminPassword: string = '';
    adminError: string = '';
    adminGames: AdminGame[] = [];

    constructor() {
        makeAutoObservable(this);
        this.service = new GameService(this);

        this.adminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        this.adminPassword = localStorage.getItem('adminPassword') || '';
    }

    //game methods
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

    async createGame(playerName: string, gridSizeX: number, gridSizeY: number) {
        this.loading = true;
        await this.service.createGame(playerName, gridSizeX, gridSizeY);
        this.loading = false;
    }
    async joinGame(gameId: string, playerName: string) {
        this.loading = true;
        await this.service.joinGame(gameId, playerName);
        this.loading = false;
    }
    async pollGameState() {
        if (!this.gameId) return;
        const state = await this.service.fetchGameState(this.gameId);
        runInAction(() => {
            this.gameState = state;
        });
    }

    //admin methods
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

    async fetchAdminGames(password: string) {
        this.loading = true;
        await this.service.fetchAdminGames(password);
        this.loading = false;
    }
    async deleteAdminGame(gameId: string, password: string) {
        this.loading = true;
        await fetch(`/api/admin/games/${gameId}?password=${encodeURIComponent(password)}`, { method: 'DELETE' });
        this.loading = false;
    }

}

export default AppState;
