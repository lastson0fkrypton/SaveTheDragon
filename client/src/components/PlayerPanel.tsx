import React from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const PlayerPanel: React.FC = observer(() => {
  const state = getAppState();

  const gameState = state.gameState;
  const playerId = state.playerId;
  
  if (!gameState || !playerId) return null;
  const player = gameState.players.find(p => p.id === playerId);

  if (!player) return null;

  return (
    <div className="player-panel">
      <span className="game-id">Game ID: {state.gameId}</span>
      <ul className="player-list">
        {gameState.players.map((p: any, idx: number) => {
          const hearts = Math.max(1, (p.maxHearts || 5) - (p.damage || 0));
          return (
            <li className={['player-list-item', idx === gameState.currentTurn ? 'current-turn' : ''].join(' ')} key={p.id}>
              <img className="player-profile-pic" src={player.profileId ? `/profile-pictures/${player.profileId}.png` : '/items/nothing.png'} alt="profile" />
              <span className="player-name">{p.name}</span>
              <span className="player-hearts">
                {Array.from({ length: p.maxHearts || 5 }, (_, i) => {
                  const heartOpacity = i < hearts ? 1 : 0.2;
                  return (
                    <img src='/heart.svg'  key={p.id + "_" + i} style={{width:'16px',height:'16px',verticalAlign:'middle',marginLeft:'2px',opacity:heartOpacity}} alt='♥' />
                  )
                })}
              </span>
            </li>)
        })}
      </ul>
    </div>
  );
});

export default PlayerPanel;
