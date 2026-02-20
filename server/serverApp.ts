import express from 'express';
import type { Server } from 'node:http';
import { initDb } from './db.js';
import adminRoutes from './routes/adminRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import battleRoutes from './routes/battleRoutes.js';
import playerRoutes from './routes/playerRoutes.js';
import lastPoll from './lastPoll.js';
import { clearGameDataById, getAllGames } from './repositories/gameRepository.js';
import { initializeGameBalanceConfig } from './config/gameBalanceConfig.js';
import { initializeBiomeDeckConfig } from './config/biomeDeckConfig.js';

type StartServerOptions = {
	port?: number;
	disableCleanupInterval?: boolean;
	silent?: boolean;
};

export function createApp() {
	const app = express();
	app.use(express.json());
	app.use(express.static('dist'));
	app.use('/api', adminRoutes);
	app.use('/api', gameRoutes);
	app.use('/api', battleRoutes);
	app.use('/api', playerRoutes);
	return app;
}

function startInactiveGameCleanup(intervalMs = 60000): NodeJS.Timeout {
	return setInterval(() => {
		const now = Date.now();
		getAllGames()
			.then(async gameRows => {
				for (const gameRow of gameRows) {
					const gameId = gameRow.id;
					let preventExpiry = false;
					try {
						const parsed = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
						preventExpiry = Boolean(parsed.preventExpiry);
					} catch (_error) {
						preventExpiry = false;
					}

					if (preventExpiry) {
						continue;
					}

					if (!lastPoll[gameId] || now - lastPoll[gameId] > intervalMs) {
						await clearGameDataById(gameId);
						delete lastPoll[gameId];
						console.log(`Game ${gameId} deleted due to inactivity.`);
					}
				}
			})
			.catch(error => {
				console.error('Failed to cleanup inactive games:', error);
			});
	}, intervalMs);
}

function waitForListening(server: Server): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once('listening', () => resolve());
		server.once('error', reject);
	});
}

export async function startServer(options: StartServerOptions = {}) {
	const port = options.port ?? 3000;
	initDb();
	initializeGameBalanceConfig(process.env.GAME_BALANCE_CONFIG_PATH);
	initializeBiomeDeckConfig(process.env.BIOME_DECK_CONFIG_PATH);

	const app = createApp();
	const server = app.listen(port);
	await waitForListening(server);

	const address = server.address();
	const actualPort = typeof address === 'object' && address ? address.port : port;
	if (!options.silent) {
		console.log(`Server is running on http://localhost:${actualPort}`);
	}

	const cleanupTimer = options.disableCleanupInterval ? null : startInactiveGameCleanup();

	return {
		app,
		port: actualPort,
		server,
		stop: async () => {
			if (cleanupTimer) {
				clearInterval(cleanupTimer);
			}
			await new Promise<void>((resolve, reject) => {
				server.close(error => {
					if (error) {
						reject(error);
						return;
					}
					resolve();
				});
			});
		},
	};
}
