import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import { CachedImage } from '../common/CachedImage';
import { getChanceStyle } from '../../utils/chanceStyle';

const LootModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
	const state = getAppState();
	const service = state.service;
	const gameState = state.gameState;
	const playerId = state.playerId;
	const [isSubmitting, setIsSubmitting] = React.useState(false);
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

	const playerName = gameState?.players?.find(p => p.id === loot.playerId)?.name || 'Unknown Player';
	const isMyLoot = loot.playerId === playerId;
	const isForcedUseHeart = isMyLoot && loot.item.type === 'item' && loot.item.effect === 'extra_heart';
	const canEquipNow = isMyLoot && (loot.item.type === 'weapon' || loot.item.type === 'armor');
	const canUseNow = isMyLoot && loot.item.type === 'item';
	const canKeepForLater = !isForcedUseHeart;

	const handleEquipNow = async () => {
		if (!canEquipNow || isSubmitting) return;
		if (loot.item.type !== 'weapon' && loot.item.type !== 'armor') return;
		setIsSubmitting(true);
		await service.equipItem(loot.item.id, loot.item.type);
		handleClose();
	};

	const handleUseNow = async () => {
		if (!canUseNow || isSubmitting) return;
		setIsSubmitting(true);
		await service.useItem(loot.item.id);
		handleClose();
	};

	return (
		<div className="modal">
			<div className="modal-window">
				<div className="modal-background-image"></div>
				<h2>{loot.playerId === playerId ? 'You found an item!' : `${playerName} found an item!`}</h2>

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
									<div className="stat defensechance chance" style={getChanceStyle(loot.item?.defenseChance || 0)}>
										<div>block</div>
										<div>hit</div>
									</div>
								</>
							)}
							{loot.item.type === 'weapon' && (
								<>
									<div className="stat attack">{loot.item?.attack || 0}</div>
									<div className="stat attackchance chance" style={getChanceStyle(loot.item?.attackChance || 0)}>
										<div>hit</div>
										<div>miss</div>
									</div>
								</>
							)}
							{loot.item.type === 'item' && (
								<div className="card-desc">
									{loot.item.heal
										? `Heals ${loot.item.heal} hearts`
										: loot.item.effect === 'full_heal' || loot.item.effect === 'heal_full'
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
				<div className="battle-modal-actions" style={{ marginTop: 16 }}>
					{canEquipNow && (
						<button onClick={handleEquipNow} className="battle-modal-action-btn" disabled={isSubmitting}>
							Equip Now
						</button>
					)}
					{canUseNow && (
						<button onClick={handleUseNow} className="battle-modal-action-btn" disabled={isSubmitting}>
							Use Now
						</button>
					)}
					{canKeepForLater && (
						<button onClick={handleClose} className="battle-modal-action-btn" disabled={isSubmitting}>
							{canEquipNow || canUseNow ? 'Keep for Later' : 'Close'}
						</button>
					)}
				</div>
			</div>
		</div>
	);
});

export default LootModal;
