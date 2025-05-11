import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';
import Inventory from '../components/Inventory';
import ProfilePicModal from '../components/ProfilePicModal';

const PlayerPanel: React.FC = observer(() => {
  const state = getAppState();

  const gameState = state.gameState;
  const playerId = state.playerId;

  const [showProfileModal, setShowProfileModal] = useState(false);

  if (!gameState || !playerId) return null;
  const player = gameState.players.find(p => p.id === playerId);

  if (!player) return null;

  
  


  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#222', color: '#fff', borderRadius: 8 }}>
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
      <button onClick={() => setShowProfileModal(true)} style={{ marginBottom: 8 }}>Change Profile Picture</button>
      <Inventory />
      
      {showProfileModal && (
        <ProfilePicModal onClose={() => {setShowProfileModal(false)}} />
      )}
    </div>
  );
});

export default PlayerPanel;
