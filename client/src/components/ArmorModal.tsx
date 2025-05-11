import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const ArmorModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
  const state = getAppState();
  const service = state.service;

  const gameState = state.gameState;
  const playerId = state.playerId;
  if (!gameState || !playerId) return null;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;
  const { inventory } = player;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, minWidth: 320, maxWidth: 400, textAlign: 'center' }}>
        <h2>Inventory</h2>

      <div>
        <b>Weapons:</b>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {inventory.weapons.map(id => (
            <div key={id} style={{ border: id === inventory.equippedWeaponId ? '2px solid #0f0' : '1px solid #555', borderRadius: 6, padding: 4, background: '#333' }}>
              <img src={gameState.itemMeta?.[id]?.img ? `/items/${gameState.itemMeta[id].img}` : '/vite.svg'} alt={id} style={{ width: 32, height: 32 }} />
              <div style={{ fontSize: 12 }}>{gameState.itemMeta?.[id]?.name || id}</div>
              {id !== inventory.equippedWeaponId && (
                <button onClick={() => service.equipItem(id, 'weapon')} style={{ fontSize: 10, marginTop: 2 }}>Equip</button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <b>Armor:</b>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {inventory.armor.map(id => (
            <div key={id} style={{ border: id === inventory.equippedArmorId ? '2px solid #0f0' : '1px solid #555', borderRadius: 6, padding: 4, background: '#333' }}>
              <img src={gameState.itemMeta?.[id]?.img ? `/items/${gameState.itemMeta[id].img}` : '/vite.svg'} alt={id} style={{ width: 32, height: 32 }} />
              <div style={{ fontSize: 12 }}>{gameState.itemMeta?.[id]?.name || id}</div>
              {id !== inventory.equippedArmorId && (
                <button onClick={() => service.equipItem(id, 'armor')} style={{ fontSize: 10, marginTop: 2 }}>Equip</button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <b>Items:</b>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {inventory.items.map(id => (
            <div key={id} style={{ border: '1px solid #555', borderRadius: 6, padding: 4, background: '#333' }}>
              <img src={gameState.itemMeta?.[id]?.img ? `/items/${gameState.itemMeta[id].img}` : '/vite.svg'} alt={id} style={{ width: 32, height: 32 }} />
              <div style={{ fontSize: 12 }}>{gameState.itemMeta?.[id]?.name || id}</div>
              <button onClick={() => service.useItem(id)} style={{ fontSize: 10, marginTop: 2 }}>Use</button>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px' }}>Close</button>
      </div>
    </div>
  );
});

export default ArmorModal;
