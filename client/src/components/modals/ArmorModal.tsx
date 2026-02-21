import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import { CachedImage } from '../common/CachedImage';
import { getChanceStyle } from '../../utils/chanceStyle';

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
		<div className="modal">
			<div className="modal-window inventory-modal-window">
				<div className="modal-background-image"></div>
				<h2>Select your Armor</h2>
				<div className="inventory inventory-scroll-area">
					{inventory.armor.map(id => {
						const eqArmor = gameState.itemMeta?.[id];
						const isEquipped = id === inventory.equippedArmorId;
						const canDiscard = !isEquipped;
						return (
							<div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
								<button
									className={'armor-panel card ' + (isEquipped ? 'equipped' : '')}
									onClick={() => {
										if (!isEquipped) {
											service.equipItem(id, 'armor');
										}
										onClose();
									}}
								>
									<CachedImage
										src={eqArmor?.img ? `/items/${eqArmor.img}` : '/items/nothing.png'}
										alt={eqArmor?.id}
										className="armor-icon card-image"
									/>
									<div className="card-overlay">
										<div className="stat defense">
											<span className="stroke">{eqArmor?.defense || 0}</span>
											<span className="fill">{eqArmor?.defense || 0}</span>
										</div>
										<div className="stat defensechance chance" style={getChanceStyle(eqArmor?.defenseChance || 0)}>
											<div>block</div>
											<div>hit</div>
										</div>
										<div className="card-name">{eqArmor?.name || 'None'}</div>
									</div>
								</button>
								<button
									onClick={async () => {
										if (!canDiscard) return;
										await service.discardItem(id);
										onClose();
									}}
									disabled={!canDiscard}
									style={{ padding: '6px 10px' }}
								>
									Discard
								</button>
							</div>
						);
					})}
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

export default ArmorModal;
