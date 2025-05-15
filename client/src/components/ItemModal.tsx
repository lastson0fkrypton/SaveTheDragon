import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';
import type { ItemMeta } from '../types';

const ItemModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
  const state = getAppState();
  const service = state.service;

  const gameState = state.gameState;
  const playerId = state.playerId;
  if (!gameState || !playerId) return null;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;
  const { inventory } = player;

  const getItemDescription = (eqItem: ItemMeta|undefined) => {
    if (eqItem?.heal) {
      return `Heals ${eqItem.heal} hearts`;
    }
    if (eqItem?.effect === 'full_heal') {
      return 'Heals all hearts';
    }
    if (eqItem?.effect === 'extra_heart') {
      return 'Increases max hearts by 1';
    }
    if (eqItem?.effect === 'teleport') {
      return 'Teleport to a random location';
    }
    return '';
  }
  return (
    <div className="modal">
      <div className="modal-window">
        <h2>Use an Item</h2>
        <div className="inventory">
            {inventory.items.map(id => {
              const eqItem = gameState.itemMeta?.[id];
	            return (<button key={id} className={"card "} onClick={() => {
                if (id !== inventory.equippedArmorId) {
                  service.useItem(id);
                }
                onClose();
              }
              }>
                <img
                  src={eqItem ? `/items/${id}.png` : '/items/nothing.png'}
                  alt={eqItem?.id}
                  className="item-icon"
                />
                <div className="card-overlay">
                  <div className="card-name">{eqItem?.name || 'None'}</div>
                  <div className="card-desc">{getItemDescription(eqItem) || 'None'}</div>
                </div>
              </button>
            );
          })}
	  
          {inventory.items.length === 0 && (
            <div style={{ color: '#aaa', fontSize: 12 }}>No items available</div>
          )}
        </div>
        <button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px' }}>Close</button>
      </div>
    </div>
  );
});

export default ItemModal;
