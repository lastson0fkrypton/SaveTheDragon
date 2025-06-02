import express from 'express';
import { initDb, db } from './db.js';
import adminRoutes from './routes/adminRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import battleRoutes from './routes/battleRoutes.js';
import playerRoutes from './routes/playerRoutes.js';
import lastPoll from './lastPoll.js';

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
	db.all('SELECT id FROM games', (err, rows) => {
		if (rows) {
			for (const row of rows) {
				const gameId = row.id;
				if (!lastPoll[gameId] || now - lastPoll[gameId] > 60000) {
					db.run('DELETE FROM games WHERE id = ?', [gameId]);
					db.run('DELETE FROM players WHERE gameId = ?', [gameId]);
					db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
					delete lastPoll[gameId];
					console.log(`Game ${gameId} deleted due to inactivity.`);
				}
			}
		}
	});
}, 60000);

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
