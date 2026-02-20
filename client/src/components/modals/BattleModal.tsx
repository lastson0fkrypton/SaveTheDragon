import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import { CachedImage } from '../common/CachedImage';
import { getChanceStyle } from '../../utils/chanceStyle';
import ItemModal from './ItemModal';

const BattleModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
	const battleLogRef = useRef<HTMLDivElement>(null);
	const [showBattleItemModal, setShowBattleItemModal] = useState(false);
	const state = getAppState();
	const gameState = state.gameState;
	const service = state.service;
	const playerId = state.playerId;
	const battle = gameState?.currentBattle;

	useEffect(() => {
		if (battleLogRef.current) {
			battleLogRef.current.scrollTop = battleLogRef.current.scrollHeight;
		}
	}, [battle?.battleLog]);

	if (!battle) return null;
	const player = gameState.players.find(p => p.id === battle.playerId);
	const isMe = playerId === battle.playerId;
	const monster = battle.monster;

	if (!player || !monster) return null;
	if (!gameState.itemMeta) return null;
	const playerCurrentHealth = Math.max(0, battle.playerHealth);
	const monsterCurrentHealth = Math.max(0, battle.monsterHealth);

	const playerWeapon = player.inventory.equippedWeaponId
		? gameState.itemMeta[player.inventory.equippedWeaponId]
		: gameState.itemMeta['fist'];
	const playerArmor = player.inventory.equippedArmorId
		? gameState.itemMeta[player.inventory.equippedArmorId]
		: undefined;

	// Unique key for this battle event
	const battleKey = battle ? `${battle.playerId}_${battle.monster?.name || 'unknown'}_${battle.ts || ''}` : null;
	// Check if this battle was already dismissed
	const lastBattleKey = typeof window !== 'undefined' && battleKey ? localStorage.getItem('lastBattleKey') : null;
	if (battleKey && lastBattleKey === battleKey) return null;
	// On close, save the battleKey so it doesn't pop up again
	const handleClose = () => {
		if (typeof window !== 'undefined' && battleKey) {
			localStorage.setItem('lastBattleKey', battleKey);
		}
		onClose();
	};

	return (
		<div className="modal">
			<div className="modal-window">
				<div className="modal-background-image battle">
					<div className="img" style={{ backgroundImage: `url(/biomes/${battle.biome}.png)` }}></div>
					<CachedImage className="hiddenimg" src={`/biomes/${battle.biome}.png`} alt={battle.biome} />
				</div>
				<h2>Battle!</h2>
				<div className="battle-modal-flex">
					<div className="battle-modal-side">
						<div className="battle-panel card">
							<CachedImage
								src={
									player?.characterId ? `/characters/${player.characterId}.png` : '/items/nothing.png'
								}
								alt={player?.name}
								className="card-image"
							/>
							<div className="card-overlay">
								<div className="card-name">{player?.name}</div>
								<div className="stat attack">
									<span className="stroke">{playerWeapon?.attack}</span>
									<span className="fill">{playerWeapon?.attack}</span>
								</div>
								<div className="stat defense">
									<span className="stroke">{playerArmor?.defense}</span>
									<span className="fill">{playerArmor?.defense}</span>
								</div>
								<div className="stat health">
									<span className="stroke">{playerCurrentHealth}</span>
									<span className="fill">{playerCurrentHealth}</span>
								</div>
								<div className="stat attackchance chance" style={getChanceStyle(playerWeapon?.attackChance || 0)}>
									<div>hit</div>
									<div>miss</div>
								</div>
								<div className="stat defensechance chance" style={getChanceStyle(playerArmor?.defenseChance || 0)}>
									<div>block</div>
									<div>hit</div>
								</div>
							</div>
						</div>
					</div>
					<div className="battle-modal-vs">VS</div>
					<div className="battle-modal-side">
						<div className="battle-panel card">
							<CachedImage
								src={`/monsters/${monster?.img || 'nothing.png'}`}
								alt={monster?.name}
								className="card-image"
							/>
							<div className="card-overlay">
								<div className="card-name">{monster?.name}</div>
								<div className="stat attack">
									<span className="stroke">{monster?.attack}</span>
									<span className="fill">{monster?.attack}</span>
								</div>
								<div className="stat defense">
									<span className="stroke">{monster?.defense}</span>
									<span className="fill">{monster?.defense}</span>
								</div>
								<div className="stat health">
									<span className="stroke">{monsterCurrentHealth}</span>
									<span className="fill">{monsterCurrentHealth}</span>
								</div>
								<div className="stat attackchance chance" style={getChanceStyle(monster?.attackChance || 0)}>
									<div>hit</div>
									<div>miss</div>
								</div>
								<div className="stat defensechance chance" style={getChanceStyle(monster?.defenseChance || 0)}>
									<div>block</div>
									<div>hit</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="battle-modal-log">
					<div className="battle-modal-log-title">Battle Log</div>
					<div className="battle-modal-log-content" ref={battleLogRef}>
						{(battle.battleLog || []).join('\n')}
					</div>
				</div>
				{isMe && battle.battleActive && (
					<div className="battle-modal-actions">
						<button onClick={() => service.attack()} className="battle-modal-action-btn">
							Attack
						</button>
						<button
							onClick={() => {
								setShowBattleItemModal(true);
							}}
							className="battle-modal-action-btn"
						>
							Use Item
						</button>
					</div>
				)}
				{isMe && !battle.battleActive && battle.monsterHealth <= 0 && (
					<div className="battle-modal-center">
						<button
							onClick={() => {
								service.collectLoot();
								handleClose();
							}}
							className="battle-modal-action-btn"
						>
							Collect Loot
						</button>
					</div>
				)}
				{isMe && !battle.battleActive && battle.playerHealth <= 0 && (
					<div className="battle-modal-center">
						<button
							onClick={() => {
								service.returnToTown();
								handleClose();
							}}
							className="battle-modal-action-btn"
						>
							Return to Town
						</button>
					</div>
				)}
				{!isMe && !battle.battleActive && (
					<div className="battle-modal-center">
						<button onClick={handleClose}>Close</button>
					</div>
				)}
				{showBattleItemModal && (
					<ItemModal
						battleMode
						onClose={() => {
							setShowBattleItemModal(false);
						}}
					/>
				)}
			</div>
		</div>
	);
});

export default BattleModal;
