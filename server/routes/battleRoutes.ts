import express from 'express';
import { attackBattle, collectBattleLoot, returnPlayerToTown, runFromBattle } from '../services/battleService.js';

const router = express.Router();

function handleError(res, error) {
	const status = error?.status || 500;
	if (status >= 500) {
		console.error(error);
	}
	return res.status(status).json({ error: error?.message || 'Server error' });
}

// --- Add your battle-related endpoints here (attack, run, collect-loot, return-to-town) ---

// --- BATTLE ENDPOINTS ---
// Player attacks monster
router.post('/games/:gameId/battle/attack', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerId } = req.body;
		const result = await attackBattle(gameId, playerId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Player runs away
router.post('/games/:gameId/battle/run', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerId } = req.body;
		const result = await runFromBattle(gameId, playerId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Player collects loot after winning
router.post('/games/:gameId/battle/collect-loot', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerId } = req.body;
		const result = await collectBattleLoot(gameId, playerId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Player returns to town after fainting (button for UI)
router.post('/games/:gameId/battle/return-to-town', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerId } = req.body;
		const result = await returnPlayerToTown(gameId, playerId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

export default router;
