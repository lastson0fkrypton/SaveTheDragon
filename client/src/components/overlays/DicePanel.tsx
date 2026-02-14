import React from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';

const DicePanel: React.FC = observer(() => {
	const state = getAppState();

	const gameState = state.gameState;
	const playerId = state.playerId;

	if (!gameState || !playerId) return null;

	const currentPlayer = gameState.players[gameState.currentTurn];
	const isMyTurn = currentPlayer?.id === playerId;
	const hasSelection = !!state.selectedMove;

	const handleRoll = async () => {
		await state.service.rollDice();
	};

	const handleEndTurn = async () => {
		if (!state.selectedMove) return;
		await state.service.movePlayer(state.selectedMove.x, state.selectedMove.y);
		state.setSelectedMove(null);
	};

	return (
		<div className="dice-panel">
			{isMyTurn && <span className="your-turn">Your Turn</span>}
			{!isMyTurn && <span className="nacho-turn">{currentPlayer.name}'s Turn</span>}

			{gameState.players[gameState.currentTurn]?.id === playerId && !gameState.currentDiceRoll && (
				<button className="roll-button disabled" onClick={handleRoll}>
					Roll Dice
				</button>
			)}
			{gameState.players[gameState.currentTurn]?.id !== playerId && !gameState.currentDiceRoll && (
				<button className="roll-button" disabled>
					<span>Waiting...</span>
				</button>
			)}
			{isMyTurn && gameState.currentDiceRoll && (
				<button className="roll-button end-turn" onClick={handleEndTurn} disabled={!hasSelection}>
					End Turn
				</button>
			)}
			{!isMyTurn && gameState.currentDiceRoll && (
				<div className="dice-result">
					<div className={`roll-value value-${gameState.currentDiceRoll}`}>
						{Array.from(Array(gameState.currentDiceRoll), (_, i) => {
							return <div key={i} className="dot"></div>;
						})}
					</div>
				</div>
			)}
		</div>
	);
});

export default DicePanel;
