import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const LootModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
  const state = getAppState();
  const gameState = state.gameState;
  const playerId = state.playerId;
  const loot = gameState?.recentlyFoundItem;
  if (!loot || !loot.item) return null;
  // Unique key for this loot event
  const lootKey = `${loot.playerId}_${loot.item.id}_${loot.ts}`;
  // Check if this loot was already dismissed
  const lastLootKey = typeof window !== 'undefined' ? localStorage.getItem('lastLootKey') : null;
  if (lastLootKey === lootKey) return null;
  // On close, save the lootKey so it doesn't pop up again
  const handleClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastLootKey', lootKey);
    }
    onClose();
  };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, minWidth: 320, maxWidth: 400, textAlign: 'center' }}>
        <h2>{loot.playerId === playerId ? 'You found an item!' : `Player found an item!`}</h2>
        <img src={loot.item.img ? `/items/${loot.item.img}` : '/vite.svg'} alt={loot.item.name} style={{ width: 64, height: 64, borderRadius: 12, border: '2px solid #fff', marginBottom: 12 }} />
        <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>{loot.item.name}</div>
        <button onClick={handleClose} style={{ marginTop: 16, padding: '8px 24px' }}>Close</button>
      </div>
    </div>
  );
});

export default LootModal;
