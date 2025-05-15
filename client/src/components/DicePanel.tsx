import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const DicePanel: React.FC = observer(() => {
    const state = getAppState();

    const gameState = state.gameState;
    const playerId = state.playerId;

    if (!gameState || !playerId) return null;


    const handleRoll = async () => {
        await state.service.rollDice();
    };

    return (
        <div className='dice-panel'>
            {gameState.players[gameState.currentTurn]?.id === playerId && !gameState.currentDiceRoll && <button className='roll-button' onClick={handleRoll}>Roll Dice</button>}
        </div>
    );
});

export default DicePanel;
