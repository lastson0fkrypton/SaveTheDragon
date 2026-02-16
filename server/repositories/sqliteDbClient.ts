import { db } from '../db.js';

let transactionQueue: Promise<void> = Promise.resolve();

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
	const runQueuedTransaction = async () => {
		try {
			await runAsync('BEGIN TRANSACTION');
			const result = await work();
			await runAsync('COMMIT');
			return result;
		} catch (error) {
			try {
				await runAsync('ROLLBACK');
			} catch (_rollbackError) {
				// Intentionally swallow rollback failure and return original error.
			}
			throw error;
		}
	};

	const transactionPromise = transactionQueue.then(runQueuedTransaction, runQueuedTransaction);
	transactionQueue = transactionPromise.then(
		() => undefined,
		() => undefined
	);
	return transactionPromise;
}

export { runAsync, getAsync, allAsync, withTransaction };
