import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';

const DicePanel: React.FC = observer(() => {
	const state = getAppState();

	const gameState = state.gameState;
	const playerId = state.playerId;

	if (!gameState || !playerId) return null;

	const currentPlayer = gameState.players[gameState.currentTurn];
	const isMyTurn = currentPlayer?.id === playerId;

	const handleRoll = async () => {
		await state.service.rollDice();
	};

	return (
		<div className="dice-panel">
			{isMyTurn && <span className="your-turn">Your Turn</span>}
			{!isMyTurn && <span>{currentPlayer.name}'s Turn</span>}

			{gameState.players[gameState.currentTurn]?.id === playerId && !gameState.currentDiceRoll && (
				<button className="roll-button" onClick={handleRoll}>
					Roll Dice
				</button>
			)}
			{gameState.players[gameState.currentTurn]?.id !== playerId && !gameState.currentDiceRoll && (
				<div className="dice-result">
					<span>Waiting...</span>
				</div>
			)}
			{gameState.currentDiceRoll && (
				<div className="dice-result">
					<span>Dice Roll: </span>
					<span className="roll-value">{gameState.currentDiceRoll}</span>
				</div>
			)}
		</div>
	);
});

export default DicePanel;
