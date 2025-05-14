import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const BattleModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
  const state = getAppState();
  const gameState = state.gameState;
  const service = state.service;
  const playerId = state.playerId;
  const battle = gameState?.currentBattle;
  if (!battle) return null;
  const player = gameState.players.find(p => p.id === battle.playerId);
  const isMe = playerId === battle.playerId;
  const monster = battle.monster;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, minWidth: 400, maxWidth: 600 }}>
        <h2>Battle!</h2>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <img src={player?.profilePic ? `/profile-pictures/${player.profilePic}` : '/vite.svg'} alt={player?.name} style={{ width: 64, height: 64, borderRadius: 12, border: '2px solid #fff' }} />
            <div>{player?.name}</div>
            <div>❤️ {battle.playerHealth}</div>
          </div>
          <div style={{ fontSize: 32 }}>VS</div>
          <div style={{ textAlign: 'center' }}>
            <img src={`/monsters/${monster?.img || 'nothing.png'}`} alt={monster?.name} style={{ width: 64, height: 64, borderRadius: 12, border: '2px solid #fff' }} />
            <div>{monster?.name}</div>
            <div>❤️ {battle.monsterHealth}</div>
          </div>
        </div>
        <div style={{ background: '#222', borderRadius: 8, padding: 12, minHeight: 80, marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Battle Log</div>
          <div style={{ fontSize: 14, whiteSpace: 'pre-line', maxHeight: 120, overflowY: 'auto' }}>{(battle.battleLog || []).join('\n')}</div>
        </div>
        {isMe && battle.battleActive && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button onClick={() => service.attack()} style={{ padding: '8px 24px' }}>Attack</button>
            <button onClick={() => service.run()} style={{ padding: '8px 24px' }}>Run Away</button>
          </div>
        )}
        {isMe && !battle.battleActive && battle.monsterHealth <= 0 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => { service.collectLoot(); onClose(); }} style={{ padding: '8px 24px' }}>Collect Loot</button>
          </div>
        )}
        {isMe && !battle.battleActive && battle.playerHealth <= 0 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => { service.returnToTown(); onClose(); }} style={{ padding: '8px 24px' }}>Return to Town</button>
          </div>
        )}
        {!isMe && <div style={{ textAlign: 'center', marginTop: 16 }}><button onClick={onClose}>Close</button></div>}
      </div>
    </div>
  );
});

export default BattleModal;
