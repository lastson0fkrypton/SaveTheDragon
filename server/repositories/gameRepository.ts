import { allAsync, getAsync, runAsync } from './dbClient.js';
import type { GameRow, PlayerRow, PlayerStateRow, ValidMoveRow } from '../types.js';

async function createGame(id: string, gameStateJson: string): Promise<void> {
	await runAsync('INSERT INTO games (id, gameStateJson) VALUES (?, ?)', [id, gameStateJson]);
}

async function getGameById(gameId: string): Promise<GameRow | null> {
	return getAsync<GameRow>('SELECT * FROM games WHERE id = ?', [gameId]);
}

async function getAllGameIds(): Promise<string[]> {
	const rows = await allAsync<{ id: string }>('SELECT id FROM games');
	return rows.map(row => row.id);
}

async function updateGameStateJson(gameId: string, gameStateJson: string): Promise<void> {
	await runAsync('UPDATE games SET gameStateJson = ? WHERE id = ?', [gameStateJson, gameId]);
}

async function getPlayerById(playerId: string): Promise<PlayerRow | null> {
	return getAsync<PlayerRow>('SELECT * FROM players WHERE id = ?', [playerId]);
}

async function getPlayerByIdAndGameId(playerId: string, gameId: string): Promise<PlayerRow | null> {
	return getAsync<PlayerRow>('SELECT * FROM players WHERE id = ? AND gameId = ?', [playerId, gameId]);
}

async function getPlayerByGameIdAndName(gameId: string, playerName: string): Promise<PlayerRow | null> {
	return getAsync<PlayerRow>('SELECT * FROM players WHERE gameId = ? AND name = ?', [gameId, playerName]);
}

async function getPlayersByGameId(gameId: string): Promise<PlayerRow[]> {
	return allAsync<PlayerRow>('SELECT * FROM players WHERE gameId = ?', [gameId]);
}

async function getPlayerStateRowsByGameId(gameId: string): Promise<PlayerStateRow[]> {
	return allAsync<PlayerStateRow>('SELECT playerStateJson FROM players WHERE gameId = ?', [gameId]);
}

async function getAllPlayers(): Promise<PlayerRow[]> {
	return allAsync<PlayerRow>('SELECT * FROM players');
}

async function createPlayer(id: string, gameId: string, name: string, playerStateJson: string): Promise<void> {
	await runAsync('INSERT INTO players (id, gameId, name, playerStateJson) VALUES (?, ?, ?, ?)', [
		id,
		gameId,
		name,
		playerStateJson,
	]);
}

async function updatePlayerStateById(playerId: string, playerStateJson: string): Promise<void> {
	await runAsync('UPDATE players SET playerStateJson = ? WHERE id = ?', [playerStateJson, playerId]);
}

async function updatePlayerStateByIdAndGameId(playerId: string, gameId: string, playerStateJson: string): Promise<void> {
	await runAsync('UPDATE players SET playerStateJson = ? WHERE id = ? AND gameId = ?', [
		playerStateJson,
		playerId,
		gameId,
	]);
}

async function deletePlayerByIdAndGameId(playerId: string, gameId: string): Promise<void> {
	await runAsync('DELETE FROM players WHERE id = ? AND gameId = ?', [playerId, gameId]);
}

async function getValidMovesByGameId(gameId: string): Promise<ValidMoveRow[]> {
	return allAsync<ValidMoveRow>('SELECT * FROM valid_moves WHERE gameId = ?', [gameId]);
}

async function clearValidMovesByGameId(gameId: string): Promise<void> {
	await runAsync('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
}

async function setValidMovesByGameId(gameId: string, moves: Array<{ x: number; y: number }>): Promise<void> {
	await clearValidMovesByGameId(gameId);
	for (const move of moves) {
		await runAsync('INSERT INTO valid_moves (gameId, x, y) VALUES (?, ?, ?)', [gameId, move.x, move.y]);
	}
}

async function clearGameDataById(gameId: string): Promise<void> {
	await runAsync('DELETE FROM games WHERE id = ?', [gameId]);
	await runAsync('DELETE FROM players WHERE gameId = ?', [gameId]);
	await runAsync('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
}

async function getAllGames(): Promise<GameRow[]> {
	return allAsync<GameRow>('SELECT * FROM games');
}

export {
	createGame,
	getGameById,
	getAllGameIds,
	updateGameStateJson,
	getPlayerById,
	getPlayerByIdAndGameId,
	getPlayerByGameIdAndName,
	getPlayersByGameId,
	getPlayerStateRowsByGameId,
	getAllPlayers,
	createPlayer,
	updatePlayerStateById,
	updatePlayerStateByIdAndGameId,
	deletePlayerByIdAndGameId,
	getValidMovesByGameId,
	clearValidMovesByGameId,
	setValidMovesByGameId,
	clearGameDataById,
	getAllGames,
};
