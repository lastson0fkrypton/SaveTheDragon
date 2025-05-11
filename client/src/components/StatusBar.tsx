import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';
import { useNavigate } from 'react-router-dom';

const StatusBar: React.FC = observer(() => {
  const navigate = useNavigate();

  const state = getAppState();
  const gameState = state.gameState;
  const playerId = state.playerId;
  if (!gameState || !playerId) return null;
  const currentPlayer = gameState.players[gameState.currentTurn];
  const isMyTurn = currentPlayer?.id === playerId;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#222', color: '#fff', borderRadius: 8 }}>
      <div>Game ID: <b>{state.gameId}</b></div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>Current turn: <b>{currentPlayer?.name || '...'}</b></div>
        {isMyTurn && <span style={{ color: '#0f0', marginLeft: 16 }}>(Your turn!)</span>}
        {gameState.currentDiceRoll && (
          <span style={{ marginLeft: 16 }}>Dice roll: <b>{gameState.currentDiceRoll}</b></span>
        )}
      </div>
      <div>
        <button onClick={() => navigate('/')}>Quit</button>
      </div>
    </div>
  );
});

export default StatusBar;
