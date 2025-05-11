import React, { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';
import ProfilePicModal from '../components/ProfilePicModal';

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
              <img className="player-profile-pic" src={player.profilePic ? `/profile-pictures/${player.profilePic}` : '/vite.svg'} alt="profile" />
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

    // <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: '#222', color: '#fff', borderRadius: 8 }}>
    //   <div>
    //     <img
    //       src={player.profilePic ? `/profile-pictures/${player.profilePic}` : '/vite.svg'}
    //       alt={player.name}
    //       style={{ width: 48, height: 48, borderRadius: 12, border: '2px solid #fff', marginRight: 16 }}
    //     />
    //     <div>
    //       <div style={{ fontWeight: 'bold', fontSize: 20 }}>{player.name}</div>
    //       <div>Hearts: {Array.from({ length: player.maxHearts || 5 }).map((_, i) => (
    //         <span key={i} style={{ color: i < ((player.maxHearts || 5) - (player.damage || 0)) ? 'red' : '#555' }}>♥</span>
    //       ))}</div>
    //     </div>
    //     <button onClick={() => setShowProfileModal(true)} style={{ marginBottom: 8 }}>Change Profile Picture</button>
    //   </div>
    //   <div>
    //     <div>Weapon: <b>{gameState.itemMeta?.[player.inventory.equippedWeaponId || 'fist']?.name || 'Fist'}</b></div>
    //     <div>Armor: <b>{player.inventory.equippedArmorId ? gameState.itemMeta?.[player.inventory.equippedArmorId]?.name : 'None'}</b></div>
    //     <button onClick={() => setShowInventoryModal(true)} style={{ marginBottom: 8 }}>Inventory</button>
    //   </div>
    //   {showInventoryModal && (<InventoryModal onClose={()=>{setShowInventoryModal(false)}} />)}
    //   {showProfileModal && (<ProfilePicModal onClose={() => {setShowProfileModal(false)}} />)}
    // </div>
  );
});

export default PlayerPanel;
