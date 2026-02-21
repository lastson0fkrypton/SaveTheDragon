import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import type { ItemMeta } from '../../types';
import { CachedImage } from '../common/CachedImage';

const ItemModal: React.FC<{ onClose: () => void; battleMode?: boolean }> = observer(({ onClose, battleMode = false }) => {
	const state = getAppState();
	const service = state.service;

	const gameState = state.gameState;
	const playerId = state.playerId;
	if (!gameState || !playerId) return null;
	const player = gameState.players.find(p => p.id === playerId);
	if (!player) return null;
	const { inventory } = player;

	const isBattleUsableItem = (item: ItemMeta | undefined): boolean => {
		if (!item) return false;
		if (typeof item.heal === 'number' && item.heal > 0) return true;
		return item.effect === 'full_heal' || item.effect === 'heal_full' || item.effect === 'extra_heart' || item.effect === 'teleport';
	};

	const availableItemIds = battleMode
		? inventory.items.filter(id => isBattleUsableItem(gameState.itemMeta?.[id]))
		: inventory.items;

	const getItemDescription = (eqItem: ItemMeta | undefined) => {
		if (eqItem?.heal) {
			return `Heals ${eqItem.heal} hearts`;
		}
		if (eqItem?.effect === 'full_heal' || eqItem?.effect === 'heal_full') {
			return 'Heals all hearts';
		}
		if (eqItem?.effect === 'extra_heart') {
			return 'Increases max hearts by 1';
		}
		if (eqItem?.effect === 'teleport') {
			return battleMode ? 'Teleport to town and end battle' : 'Teleport to a random location';
		}
		return '';
	};

	return (
		<div className="modal">
			<div className="modal-window inventory-modal-window">
				<div className="modal-background-image"></div>
				<h2>{battleMode ? 'Use Battle Item' : 'Use an Item'}</h2>
				<div className="inventory inventory-scroll-area">
					{availableItemIds.map(id => {
						const eqItem = gameState.itemMeta?.[id];
						return (
							<button
								key={id}
								className={'card '}
								onClick={() => {
									if (id !== inventory.equippedArmorId) {
										if (battleMode) {
											service.useBattleItem(id);
										} else {
											service.useItem(id);
										}
									}
									onClose();
								}}
							>
								<CachedImage
									src={eqItem?.img ? `/items/${eqItem.img}` : '/items/nothing.png'}
									alt={eqItem?.id}
									className="card-image"
								/>
								<div className="card-overlay">
									<div className="card-name">{eqItem?.name || 'None'}</div>
									<div className="card-desc">{getItemDescription(eqItem) || 'None'}</div>
								</div>
							</button>
						);
					})}

					{availableItemIds.length === 0 && (
						<div style={{ color: '#aaa', fontSize: 12 }}>No items available</div>
					)}
				</div>
				<div className="inventory-modal-actions">
					<button onClick={onClose} style={{ padding: '8px 24px' }}>
						Close
					</button>
				</div>
			</div>
		</div>
	);
});

export default ItemModal;
