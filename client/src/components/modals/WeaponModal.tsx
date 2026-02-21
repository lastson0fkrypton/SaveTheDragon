import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import { CachedImage } from '../common/CachedImage';
import { getChanceStyle } from '../../utils/chanceStyle';

const WeaponModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
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
				<h2>Select your Weapon</h2>
				<div className="inventory inventory-scroll-area">
					{inventory.weapons.map(id => {
						const eqWeapon = gameState.itemMeta?.[id];
						const isEquipped = id === inventory.equippedWeaponId;
						const canDiscard = id !== 'fist' && !isEquipped;
						return (
							<div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
								<button
									className={'weapon-panel card ' + (isEquipped ? 'equipped' : '')}
									onClick={() => {
										if (!isEquipped) {
											service.equipItem(id, 'weapon');
										}
										onClose();
									}}
								>
									<CachedImage
										src={eqWeapon?.img ? `/items/${eqWeapon.img}` : '/items/nothing.png'}
										alt={eqWeapon?.id}
										className="weapon-icon card-image"
									/>
									<div className="card-overlay">
										<div className="stat attack">
											<span className="stroke">{eqWeapon?.attack || 0}</span>
											<span className="fill">{eqWeapon?.attack || 0}</span>
										</div>
										<div className="stat attackchance chance" style={getChanceStyle(eqWeapon?.attackChance || 0)}>
											<div>hit</div>
											<div>miss</div>
										</div>
										<div className="card-name">{eqWeapon?.name || 'Fist'}</div>
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

export default WeaponModal;
