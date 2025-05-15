import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const WeaponModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
  const state = getAppState();
  const service = state.service;

  const gameState = state.gameState;
  const playerId = state.playerId;
  if (!gameState || !playerId) return null;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;
  const { inventory } = player;

  const percent = (val: number, max: number): string => {
    return Math.round((val / max) * 100).toString();
  }

  return (
    <div className="modal">
      <div className="modal-window">
        <h2>Weapons</h2>
          <div className="inventory">
            {inventory.weapons.map(id => {
                const eqWeapon = gameState.itemMeta?.[id];
                return (
                  <button key={id} className={"weapon-panel card " + (id === inventory.equippedWeaponId ? "equipped" : "")} onClick={() => {
                    if (id !== inventory.equippedWeaponId) {
                      service.equipItem(id, 'weapon')
                    }
                    onClose();
                  }
                  }>
                      <img
                          src={eqWeapon ? `/items/${eqWeapon.id}.png` : '/items/nothing.png'}
                          alt={eqWeapon?.id}
                          className="weapon-icon item-icon"
                      />
                      <div className="card-overlay">
                          <div className="stat attack">{eqWeapon?.attack || 0}</div>
                          <div className={"stat chance chance" + percent(eqWeapon?.attackChance || 0, 1)}>
                              <div>hit</div>
                              <div>miss</div>
                          </div>
                          <div className="card-name">{eqWeapon?.name || 'Fist'}</div>
                      </div>
                  </button>
                );
            })}
        </div>
        <button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px' }}>Close</button>
      </div>
    </div>
  );
});

export default WeaponModal;
