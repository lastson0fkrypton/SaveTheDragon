import React from 'react';
import type { GameState } from '../types';

interface LootModalProps {
  gameState: GameState;
  playerId: string;
  onClose: () => void;
}

const LootModal: React.FC<LootModalProps> = ({ gameState, playerId, onClose }) => {
  const loot = gameState.recentlyFoundItem;
  if (!loot || !loot.item) return null;
  const isMe = loot.playerId === playerId;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, minWidth: 320, maxWidth: 400, textAlign: 'center' }}>
        <h2>{isMe ? 'You found an item!' : `Player found an item!`}</h2>
        <img src={loot.item.img ? `/items/${loot.item.img}` : '/vite.svg'} alt={loot.item.name} style={{ width: 64, height: 64, borderRadius: 12, border: '2px solid #fff', marginBottom: 12 }} />
        <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>{loot.item.name}</div>
        <button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px' }}>Close</button>
      </div>
    </div>
  );
};

export default LootModal;
