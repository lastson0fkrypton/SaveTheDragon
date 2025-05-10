import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useAppState';

const PlayerPanel: React.FC = observer(() => {
  const store = useStore();
  const gameState = store.gameState;
  const playerId = store.playerId;
  if (!gameState || !playerId) return null;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;
  return (
    <div style={{ background: '#222', color: '#fff', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <img
          src={player.profilePic ? `/profile-pictures/${player.profilePic}` : '/vite.svg'}
          alt={player.name}
          style={{ width: 48, height: 48, borderRadius: 12, border: '2px solid #fff', marginRight: 16 }}
        />
        <div>
          <div style={{ fontWeight: 'bold', fontSize: 20 }}>{player.name}</div>
          <div>Hearts: {Array.from({ length: player.maxHearts || 5 }).map((_, i) => (
            <span key={i} style={{ color: i < ((player.maxHearts || 5) - (player.damage || 0)) ? 'red' : '#555' }}>♥</span>
          ))}</div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div>Weapon: <b>{gameState.itemMeta?.[player.inventory.equippedWeaponId || 'fist']?.name || 'Fist'}</b></div>
        <div>Armor: <b>{player.inventory.equippedArmorId ? gameState.itemMeta?.[player.inventory.equippedArmorId]?.name : 'None'}</b></div>
      </div>
    </div>
  );
});

export default PlayerPanel;
