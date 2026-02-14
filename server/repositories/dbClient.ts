import { db } from '../db.js';

function runAsync(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
	return new Promise((resolve, reject) => {
		db.run(sql, params, function onRun(err) {
			if (err) return reject(err);
			resolve({ lastID: this.lastID, changes: this.changes });
		});
	});
}

function getAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
	return new Promise((resolve, reject) => {
		db.get(sql, params, (err, row) => {
			if (err) return reject(err);
			resolve((row as T) || null);
		});
	});
}

function allAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
	return new Promise((resolve, reject) => {
		db.all(sql, params, (err, rows) => {
			if (err) return reject(err);
			resolve((rows as T[]) || []);
		});
	});
}

function withTransaction<T>(work: () => Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		db.serialize(async () => {
			try {
				await runAsync('BEGIN TRANSACTION');
				const result = await work();
				await runAsync('COMMIT');
				resolve(result);
			} catch (error) {
				try {
					await runAsync('ROLLBACK');
				} catch (_rollbackError) {
					// Intentionally swallow rollback failure and return original error.
				}
				reject(error);
			}
		});
	});
}

export { runAsync, getAsync, allAsync, withTransaction };
