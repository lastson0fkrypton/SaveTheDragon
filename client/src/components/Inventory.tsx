import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useAppState';

const Inventory: React.FC = observer(() => {
  const store = useStore();
  const gameState = store.gameState;
  const playerId = store.playerId;
  if (!gameState || !playerId) return null;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;
  const { inventory } = player;
  return (
    <div style={{ background: '#222', color: '#fff', padding: 16, borderRadius: 8, marginTop: 16 }}>
      <h3>Inventory</h3>
      <div>
        <b>Weapons:</b>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {inventory.weapons.map(id => (
            <div key={id} style={{ border: id === inventory.equippedWeaponId ? '2px solid #0f0' : '1px solid #555', borderRadius: 6, padding: 4, background: '#333' }}>
              <img src={gameState.itemMeta?.[id]?.img ? `/items/${gameState.itemMeta[id].img}` : '/vite.svg'} alt={id} style={{ width: 32, height: 32 }} />
              <div style={{ fontSize: 12 }}>{gameState.itemMeta?.[id]?.name || id}</div>
              {id !== inventory.equippedWeaponId && (
                <button onClick={() => store.service.equipItem(id)} style={{ fontSize: 10, marginTop: 2 }}>Equip</button>
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
                <button onClick={() => store.service.equipItem(id)} style={{ fontSize: 10, marginTop: 2 }}>Equip</button>
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
              <button onClick={() => store.service.useItem(id)} style={{ fontSize: 10, marginTop: 2 }}>Use</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default Inventory;
