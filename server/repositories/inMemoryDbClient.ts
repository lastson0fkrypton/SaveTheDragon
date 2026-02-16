import type { GameRow, PlayerRow, PlayerStateRow, ValidMoveRow } from '../types.js';

const games = new Map<string, GameRow>();
const players = new Map<string, PlayerRow>();
const validMovesByGame = new Map<string, ValidMoveRow[]>();

let transactionQueue: Promise<void> = Promise.resolve();

function normalizeSql(sql: string): string {
	return sql.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cloneGame(row: GameRow): GameRow {
	return { ...row };
}

function clonePlayer(row: PlayerRow): PlayerRow {
	return { ...row };
}

function cloneValidMove(row: ValidMoveRow): ValidMoveRow {
	return { ...row };
}

function constraintError(message: string): never {
	throw new Error(`SQLITE_CONSTRAINT: ${message}`);
}

async function runAsync(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
	const normalized = normalizeSql(sql);

	if (normalized === 'begin transaction' || normalized === 'commit' || normalized === 'rollback') {
		return { lastID: 0, changes: 0 };
	}

	if (normalized === 'insert into games (id, gamestatejson) values (?, ?)') {
		const id = String(params[0]);
		const gameStateJson = String(params[1]);
		if (games.has(id)) {
			constraintError('UNIQUE constraint failed: games.id');
		}
		games.set(id, { id, gameStateJson });
		return { lastID: 0, changes: 1 };
	}

	if (normalized === 'update games set gamestatejson = ? where id = ?') {
		const gameStateJson = String(params[0]);
		const id = String(params[1]);
		const row = games.get(id);
		if (!row) return { lastID: 0, changes: 0 };
		games.set(id, { ...row, gameStateJson });
		return { lastID: 0, changes: 1 };
	}

	if (normalized === 'insert into players (id, gameid, name, playerstatejson) values (?, ?, ?, ?)') {
		const id = String(params[0]);
		const gameId = String(params[1]);
		const name = String(params[2]);
		const playerStateJson = String(params[3]);
		if (players.has(id)) {
			constraintError('UNIQUE constraint failed: players.id');
		}
		players.set(id, { id, gameId, name, playerStateJson });
		return { lastID: 0, changes: 1 };
	}

	if (normalized === 'update players set playerstatejson = ? where id = ?') {
		const playerStateJson = String(params[0]);
		const playerId = String(params[1]);
		const row = players.get(playerId);
		if (!row) return { lastID: 0, changes: 0 };
		players.set(playerId, { ...row, playerStateJson });
		return { lastID: 0, changes: 1 };
	}

	if (normalized === 'update players set playerstatejson = ? where id = ? and gameid = ?') {
		const playerStateJson = String(params[0]);
		const playerId = String(params[1]);
		const gameId = String(params[2]);
		const row = players.get(playerId);
		if (!row || row.gameId !== gameId) return { lastID: 0, changes: 0 };
		players.set(playerId, { ...row, playerStateJson });
		return { lastID: 0, changes: 1 };
	}

	if (normalized === 'delete from players where id = ? and gameid = ?') {
		const playerId = String(params[0]);
		const gameId = String(params[1]);
		const row = players.get(playerId);
		if (!row || row.gameId !== gameId) return { lastID: 0, changes: 0 };
		players.delete(playerId);
		return { lastID: 0, changes: 1 };
	}

	if (normalized === 'delete from valid_moves where gameid = ?') {
		const gameId = String(params[0]);
		const previous = validMovesByGame.get(gameId) || [];
		validMovesByGame.set(gameId, []);
		return { lastID: 0, changes: previous.length };
	}

	if (normalized === 'insert into valid_moves (gameid, x, y) values (?, ?, ?)') {
		const gameId = String(params[0]);
		const x = Number(params[1]);
		const y = Number(params[2]);
		const list = validMovesByGame.get(gameId) || [];
		list.push({ gameId, x, y });
		validMovesByGame.set(gameId, list);
		return { lastID: 0, changes: 1 };
	}

	if (normalized === 'delete from games where id = ?') {
		const gameId = String(params[0]);
		const existed = games.delete(gameId);
		return { lastID: 0, changes: existed ? 1 : 0 };
	}

	if (normalized === 'delete from players where gameid = ?') {
		const gameId = String(params[0]);
		let removed = 0;
		for (const [playerId, row] of players.entries()) {
			if (row.gameId === gameId) {
				players.delete(playerId);
				removed += 1;
			}
		}
		return { lastID: 0, changes: removed };
	}

	throw new Error(`In-memory db client does not support SQL: ${sql}`);
}

async function getAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
	const normalized = normalizeSql(sql);

	if (normalized === 'select * from games where id = ?') {
		const gameId = String(params[0]);
		const row = games.get(gameId);
		return (row ? cloneGame(row) : null) as T | null;
	}

	if (normalized === 'select * from players where id = ?') {
		const playerId = String(params[0]);
		const row = players.get(playerId);
		return (row ? clonePlayer(row) : null) as T | null;
	}

	if (normalized === 'select * from players where id = ? and gameid = ?') {
		const playerId = String(params[0]);
		const gameId = String(params[1]);
		const row = players.get(playerId);
		return (row && row.gameId === gameId ? clonePlayer(row) : null) as T | null;
	}

	if (normalized === 'select * from players where gameid = ? and name = ?') {
		const gameId = String(params[0]);
		const name = String(params[1]);
		for (const row of players.values()) {
			if (row.gameId === gameId && row.name === name) {
				return clonePlayer(row) as T;
			}
		}
		return null;
	}

	throw new Error(`In-memory db client does not support SQL: ${sql}`);
}

async function allAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
	const normalized = normalizeSql(sql);

	if (normalized === 'select id from games') {
		return Array.from(games.values(), row => ({ id: row.id })) as T[];
	}

	if (normalized === 'select * from players where gameid = ?') {
		const gameId = String(params[0]);
		return Array.from(players.values())
			.filter(row => row.gameId === gameId)
			.map(clonePlayer) as T[];
	}

	if (normalized === 'select playerstatejson from players where gameid = ?') {
		const gameId = String(params[0]);
		return Array.from(players.values())
			.filter(row => row.gameId === gameId)
			.map<PlayerStateRow>(row => ({ playerStateJson: row.playerStateJson })) as T[];
	}

	if (normalized === 'select * from players') {
		return Array.from(players.values()).map(clonePlayer) as T[];
	}

	if (normalized === 'select * from valid_moves where gameid = ?') {
		const gameId = String(params[0]);
		return (validMovesByGame.get(gameId) || []).map(cloneValidMove) as T[];
	}

	if (normalized === 'select * from games') {
		return Array.from(games.values()).map(cloneGame) as T[];
	}

	throw new Error(`In-memory db client does not support SQL: ${sql}`);
}

function withTransaction<T>(work: () => Promise<T>): Promise<T> {
	const runQueuedTransaction = async () => work();
	const transactionPromise = transactionQueue.then(runQueuedTransaction, runQueuedTransaction);
	transactionQueue = transactionPromise.then(
		() => undefined,
		() => undefined
	);
	return transactionPromise;
}

export { runAsync, getAsync, allAsync, withTransaction };
