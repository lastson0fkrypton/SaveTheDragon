import express from 'express';
import { deleteAdminGame, listAdminGames } from '../services/adminService.js';

const router = express.Router();

function handleError(res, error) {
	const status = error?.status || 500;
	if (status >= 500) {
		console.error(error);
	}
	return res.status(status).json({ error: error?.message || 'Server error' });
}

// Admin endpoint to list all games (requires password)
router.get('/admin/games', async (req, res) => {
	try {
		const result = await listAdminGames(req.query.password);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Admin endpoint to delete a game (requires password)
router.delete('/admin/games/:gameId', async (req, res) => {
	try {
		const { gameId } = req.params;
		const result = await deleteAdminGame(gameId, req.query.password);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

export default router;
