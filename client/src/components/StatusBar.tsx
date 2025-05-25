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
    <div className='status-bar'>
      {isMyTurn && (<span className="your-turn">Your Turn</span>)}
      {!isMyTurn && (<span>{currentPlayer.name}'s Turn</span>)}

      <button className="quit-btn" onClick={() => navigate('/')}>Quit Game</button>
    </div>
  );
});

export default StatusBar;
