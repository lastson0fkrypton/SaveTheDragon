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

  const percent = (val: number, max: number): string => {
    return Math.round((val / max) * 100).toString();
  }

  return (
    <div className="modal">
      <div className="modal-window">
        <h2>Armor</h2>
        <div className="modal-inventory">
          {inventory.armor.map(id => {
            const eqArmor = gameState.itemMeta?.[id];
            return (
              <button key={id} className={"armor-panel card " + (id === inventory.equippedArmorId ? "equipped" : "")} onClick={() => {
                if (id !== inventory.equippedArmorId) {
                  service.equipItem(id, 'armor')
                }
                onClose();
              }
              }>
                <img
                  src={eqArmor ? `/items/${eqArmor.id}.png` : '/items/nothing.png'}
                  alt={eqArmor?.id}
                  className="armor-icon item-icon"
                />
                <div className="card-overlay">
                  <div className="stat defense">{eqArmor?.defense || 0}</div>
                  <div className={"stat chance chance" + percent(eqArmor?.defenseChance || 0, 1)}>
                    <div>block</div>
                    <div>hit</div>
                  </div>
                  <div className="card-name">{eqArmor?.name || 'None'}</div>
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

export default ArmorModal;
