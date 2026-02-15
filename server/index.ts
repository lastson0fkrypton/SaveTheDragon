import express from 'express';
import { initDb } from './db.js';
import adminRoutes from './routes/adminRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import battleRoutes from './routes/battleRoutes.js';
import playerRoutes from './routes/playerRoutes.js';
import lastPoll from './lastPoll.js';
import { clearGameDataById, getAllGames } from './repositories/gameRepository.js';

const app = express();
const PORT = 3000;

initDb();

app.use(express.json());
app.use(express.static('dist'));

// Mount routes
app.use('/api', adminRoutes);
app.use('/api', gameRoutes);
app.use('/api', battleRoutes);
app.use('/api', playerRoutes);

// Periodically clean up inactive games (no poll in 60s)
setInterval(() => {
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

				if (!lastPoll[gameId] || now - lastPoll[gameId] > 60000) {
					await clearGameDataById(gameId);
					delete lastPoll[gameId];
					console.log(`Game ${gameId} deleted due to inactivity.`);
				}
			}
		})
		.catch(error => {
			console.error('Failed to cleanup inactive games:', error);
		});
}, 60000);

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
