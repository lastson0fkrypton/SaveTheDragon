import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Admin endpoint to list all games (requires password)
router.get('/admin/games', (req, res) => {
	const password = req.query.password;
	if (password !== 'superman') {
		return res.status(403).json({ error: 'Forbidden' });
	}
	db.all('SELECT * FROM games', (err, gameRows) => {
		db.all('SELECT * FROM players', (err, playerRows) => {
			const allGames = gameRows.map(gameRow => ({
				gameId: gameRow.id,
				players: playerRows.filter(p => p.gameId === gameRow.id).map(p => ({ id: p.id, name: p.name })),
				currentTurn: playerRows.filter(p => p.gameId === gameRow.id)[gameRow.currentTurn]?.name || null,
				currentDiceRoll: gameRow.currentDiceRoll || null,
			}));
			res.json(allGames);
		});
	});
});

// Admin endpoint to delete a game (requires password)
router.delete('/admin/games/:gameId', (req, res) => {
	const password = req.query.password;
	if (password !== 'superman') {
		return res.status(403).json({ error: 'Forbidden' });
	}
	const { gameId } = req.params;
	db.run('DELETE FROM games WHERE id = ?', [gameId], err => {
		db.run('DELETE FROM players WHERE gameId = ?', [gameId]);
		db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
		res.json({ success: true });
	});
});

export default router;
