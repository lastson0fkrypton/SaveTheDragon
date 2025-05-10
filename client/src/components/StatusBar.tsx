import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useAppState';

const StatusBar: React.FC = observer(() => {
  const store = useStore();
  const gameState = store.gameState;
  const playerId = store.playerId;
  if (!gameState || !playerId) return null;
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
});

export default StatusBar;
