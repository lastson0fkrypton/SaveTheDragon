import { clearGameDataById, getAllGames, getAllPlayers } from '../repositories/gameRepository.js';
import { serviceError } from './serviceErrors.js';

const ADMIN_PASSWORD = 'superman';

function assertAdmin(password) {
	if (password !== ADMIN_PASSWORD) {
		throw serviceError(403, 'Forbidden');
	}
}

async function listAdminGames(password) {
	assertAdmin(password);
	const [gameRows, playerRows] = await Promise.all([getAllGames(), getAllPlayers()]);
	return gameRows.map(gameRow => ({
		gameId: gameRow.id,
		players: playerRows.filter(p => p.gameId === gameRow.id).map(p => ({ id: p.id, name: p.name })),
		currentTurn: playerRows.filter(p => p.gameId === gameRow.id)[gameRow.currentTurn]?.name || null,
		currentDiceRoll: gameRow.currentDiceRoll || null,
	}));
}

async function deleteAdminGame(gameId, password) {
	assertAdmin(password);
	await clearGameDataById(gameId);
	return { success: true };
}

export { listAdminGames, deleteAdminGame };
