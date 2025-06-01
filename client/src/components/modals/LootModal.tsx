import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import { CachedImage } from '../common/CachedImage';

const LootModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
	const state = getAppState();
	const gameState = state.gameState;
	const playerId = state.playerId;
	const loot = gameState?.recentlyFoundItem;
	if (!loot || !loot.item) return null;
	// Unique key for this loot event
	const lootKey = `${loot.playerId}_${loot.item.id}_${loot.ts}`;
	// Check if this loot was already dismissed
	const lastLootKey = typeof window !== 'undefined' ? localStorage.getItem('lastLootKey') : null;
	if (lastLootKey === lootKey) return null;
	// On close, save the lootKey so it doesn't pop up again
	const handleClose = () => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('lastLootKey', lootKey);
		}
		onClose();
	};
	const percent = (val: number, max: number): string => {
		return Math.round((val / max) * 100).toString();
	};

	const getCardType = (itemType: string): string => {
		switch (itemType) {
			case 'armor':
				return 'armor-panel';
			case 'weapon':
				return 'weapon-panel';
			default:
				return '';
		}
	};

	return (
		<div className="modal">
			<div className="modal-window">
				<div className="modal-background-image">
					<CachedImage src={`/icons/Items.png`} />
				</div>
				<h2>{loot.playerId === playerId ? 'You found an item!' : `Player found an item!`}</h2>

				<div className="inventory">
					<div className={`card ${getCardType(loot.item.type)}`}>
						<CachedImage
							src={loot.item.img ? `/items/${loot.item.img}` : '/items/nothing.png'}
							alt={loot.item.name}
							className="card-image"
						/>
						<div className="card-overlay">
							<div className="card-name">{loot.item.name || 'None'}</div>
							{loot.item.type === 'armor' && (
								<>
									<div className="stat defense">{loot.item?.defense || 0}</div>
									<div
										className={
											'stat defensechance chance chance' +
											percent(loot.item?.defenseChance || 0, 1)
										}
									>
										<div>block</div>
										<div>hit</div>
									</div>
								</>
							)}
							{loot.item.type === 'weapon' && (
								<>
									<div className="stat attack">{loot.item?.attack || 0}</div>
									<div
										className={
											'stat attackchance chance chance' + percent(loot.item?.attackChance || 0, 1)
										}
									>
										<div>hit</div>
										<div>miss</div>
									</div>
								</>
							)}
							{loot.item.type === 'item' && (
								<div className="card-desc">
									{loot.item.heal
										? `Heals ${loot.item.heal} hearts`
										: loot.item.effect === 'full_heal'
										? 'Heals all hearts'
										: loot.item.effect === 'extra_heart'
										? 'Increases max hearts by 1'
										: loot.item.effect === 'teleport'
										? 'Teleport to a the nearest town'
										: ''}
								</div>
							)}
						</div>
					</div>
				</div>
				<button onClick={handleClose} style={{ marginTop: 16, padding: '8px 24px' }}>
					Close
				</button>
			</div>
		</div>
	);
});

export default LootModal;
