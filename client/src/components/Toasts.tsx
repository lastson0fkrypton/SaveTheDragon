import React from 'react';
import type { GameState } from '../types';

interface ToastsProps {
  gameState: GameState;
}

const Toasts: React.FC<ToastsProps> = ({ gameState }) => {
  if (!gameState.recentActions || gameState.recentActions.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
      {gameState.recentActions.slice(-3).reverse().map(action => (
        <div key={action.id} style={{ background: '#333', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, minWidth: 200, boxShadow: '0 2px 8px #0008' }}>
          <b>{action.playerName}</b> {action.type === 'equip' && 'equipped'}{action.type === 'use-item' && 'used'}{action.type === 'battle-end' && ''} <b>{action.itemName}</b>
        </div>
      ))}
    </div>
  );
};

export default Toasts;
