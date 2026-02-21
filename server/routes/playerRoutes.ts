import express from 'express';
import { discardItem, equipItem, listCharacters, updateCharacter, useItem } from '../services/playerService.js';

const router = express.Router();

function handleError(res, error) {
	const status = error?.status || 500;
	if (status >= 500) {
		console.error(error);
	}
	return res.status(status).json({ error: error?.message || 'Server error' });
}

// --- Add your player-related endpoints here (character select, equip, use-item, etc.) ---

// Endpoint to list available characters
router.get('/characters', async (req, res) => {
	try {
		const characters = await listCharacters();
		return res.json(characters);
	} catch (error) {
		return handleError(res, error);
	}
});

// Endpoint to update a player's character
router.post('/games/:gameId/player/:playerId/character', async (req, res) => {
	try {
		const { gameId, playerId } = req.params;
		const { characterId } = req.body;
		const result = await updateCharacter(gameId, playerId, characterId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Equip weapon or armor
router.post('/games/:gameId/player/:playerId/equip', async (req, res) => {
	try {
		const { gameId, playerId } = req.params;
		const { itemId } = req.body;
		const result = await equipItem(gameId, playerId, itemId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

// Use item (e.g., potion, teleport, extra heart)
router.post('/games/:gameId/player/:playerId/use-item', async (req, res) => {
	try {
		const { gameId, playerId } = req.params;
		const { itemId } = req.body;
		const result = await useItem(gameId, playerId, itemId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

router.post('/games/:gameId/player/:playerId/discard', async (req, res) => {
	try {
		const { gameId, playerId } = req.params;
		const { itemId } = req.body;
		const result = await discardItem(gameId, playerId, itemId);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
});

export default router;
