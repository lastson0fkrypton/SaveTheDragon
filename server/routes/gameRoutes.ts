import express from 'express';
import {
	abandonPlayerQuest,
	createNewGame,
	joinExistingGame,
	loadSerializedGame,
	movePlayerToTarget,
	reconnectPlayer,
	resolveTownQuestOffer,
	rollDiceForPlayer,
} from '../services/gameService.js';
import lastPoll from '../lastPoll.js';

const router = express.Router();

function handleError(res, error) {
	const status = error?.status || 500;
	if (status >= 500) {
		console.error(error);
	}
	return res.status(status).json({ error: error?.message || 'Server error' });
}

// --- Game creation ---
router.post('/games', async (req, res) => {
	try {
		const { gridSizeX, gridSizeY } = req.body;
		const result = await createNewGame(gridSizeX, gridSizeY);
		return res.status(201).json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Join an existing game
router.post('/games/:gameId/join', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerName } = req.body;
		const result = await joinExistingGame(gameId, playerName);
		return res.status(200).json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Fetch game state
router.get('/games/:gameId', async (req, res) => {
	try {
		const { gameId } = req.params;
		const state = await loadSerializedGame(gameId);
		return res.json(state);
	} catch (error) {
		return handleError(res, error);
	}
});

// Roll dice and return the number of spaces the player can move, plus valid moves
router.post('/games/:gameId/roll', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerId } = req.body;
		const result = await rollDiceForPlayer(gameId, playerId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Validate and process the player's move
router.post('/games/:gameId/move', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerId, targetX, targetY } = req.body;
		const gameState = await movePlayerToTarget(gameId, playerId, targetX, targetY);
		return res.json({ success: true, gameState });
	} catch (error) {
		return handleError(res, error);
	}
});

// Fetch the latest game state
router.get('/games/:gameId/state', async (req, res) => {
	try {
		const { gameId } = req.params;
		lastPoll[gameId] = Date.now();
		const state = await loadSerializedGame(gameId);
		return res.json(state);
	} catch (error) {
		return handleError(res, error);
	}
});

// Reconnect a player to a game
router.post('/games/:gameId/reconnect', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerName } = req.body;
		const result = await reconnectPlayer(gameId, playerName);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

router.post('/games/:gameId/quests/respond', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerId, action } = req.body;
		if (action !== 'accept' && action !== 'reject') {
			return res.status(400).json({ error: "Action must be 'accept' or 'reject'." });
		}
		const gameState = await resolveTownQuestOffer(gameId, playerId, action);
		return res.json({ success: true, gameState });
	} catch (error) {
		return handleError(res, error);
	}
});

router.post('/games/:gameId/quests/abandon', async (req, res) => {
	try {
		const { gameId } = req.params;
		const { playerId, questInstanceId } = req.body;
		const gameState = await abandonPlayerQuest(gameId, playerId, questInstanceId);
		return res.json({ success: true, gameState });
	} catch (error) {
		return handleError(res, error);
	}
});

export default router;
