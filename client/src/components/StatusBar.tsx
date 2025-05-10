import React from 'react';
import type { GameState } from '../types';

interface StatusBarProps {
  gameState: GameState;
  playerId: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ gameState, playerId }) => {
  const currentPlayer = gameState.players[gameState.currentTurn];
  const isMyTurn = currentPlayer?.id === playerId;
  return (
    <div style={{ background: '#333', color: '#fff', padding: 8, borderRadius: 8, marginBottom: 12, fontSize: 16 }}>
      <span>Current turn: <b>{currentPlayer?.name || '...'}</b></span>
      {isMyTurn && <span style={{ color: '#0f0', marginLeft: 16 }}>(Your turn!)</span>}
      {gameState.currentDiceRoll && (
        <span style={{ marginLeft: 16 }}>Dice roll: <b>{gameState.currentDiceRoll}</b></span>
      )}
    </div>
  );
};

export default StatusBar;
