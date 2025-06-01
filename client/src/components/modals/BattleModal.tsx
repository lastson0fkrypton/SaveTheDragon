import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import { CachedImage } from '../common/CachedImage';

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

	if (!player || !monster) return null;
	if (!gameState.itemMeta) return null;

	const playerWeapon = player.inventory.equippedWeaponId
		? gameState.itemMeta[player.inventory.equippedWeaponId]
		: gameState.itemMeta['fist'];
	const playerArmor = player.inventory.equippedArmorId
		? gameState.itemMeta[player.inventory.equippedArmorId]
		: undefined;

	const percent = (val: number, max: number): string => {
		return Math.round((val / max) * 100).toString();
	};

	return (
		<div className="modal">
			<div className="modal-window">
				<div className="modal-background-image">
					<CachedImage src={`/biomes/${battle.biome}.png`} alt={battle.biome} />
				</div>

				<h2>Battle!</h2>
				<div className="battle-modal-flex">
					<div className="battle-modal-side">
						<div className="battle-panel card">
							<div className="floating-hearts">
								{Array.from({ length: player?.maxHearts || 0 }, (_, i) => (
									<CachedImage
										key={i}
										src="/icons/Heart.png"
										alt="heart"
										style={{
											opacity: i < battle.playerHealth ? 1 : 0.2,
										}}
										className="heart-icon"
									/>
								))}
							</div>
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
									<span className="stroke">{player?.maxHearts}</span>
									<span className="fill">{player?.maxHearts}</span>
								</div>
								<div
									className={
										'stat attackchance chance chance' + percent(playerWeapon?.attackChance || 0, 1)
									}
								>
									<div>hit</div>
									<div>miss</div>
								</div>
								<div
									className={
										'stat defensechance chance chance' + percent(playerArmor?.attackChance || 0, 1)
									}
								>
									<div>block</div>
									<div>hit</div>
								</div>
							</div>
						</div>
					</div>
					<div className="battle-modal-vs">VS</div>
					<div className="battle-modal-side">
						<div className="battle-panel card">
							<div className="floating-hearts">
								{Array.from({ length: monster?.health || 0 }, (_, i) => (
									<CachedImage
										key={i}
										src="/icons/Heart.png"
										alt="heart"
										style={{
											opacity: i < battle.monsterHealth ? 1 : 0.2,
										}}
										className="heart-icon"
									/>
								))}
							</div>
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
									<span className="stroke">{playerWeapon.attack}</span>
									<span className="fill">{monster?.health}</span>
								</div>
								<div
									className={
										'stat attackchance chance chance' + percent(monster?.attackChance || 0, 1)
									}
								>
									<div>hit</div>
									<div>miss</div>
								</div>
								<div
									className={
										'stat defensechance chance chance' + percent(monster?.defenseChance || 0, 1)
									}
								>
									<div>block</div>
									<div>hit</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="battle-modal-log">
					<div className="battle-modal-log-title">Battle Log</div>
					<div className="battle-modal-log-content">{(battle.battleLog || []).join('\n')}</div>
				</div>
				{isMe && battle.battleActive && (
					<div className="battle-modal-actions">
						<button onClick={() => service.attack()} className="battle-modal-action-btn">
							Attack
						</button>
						<button onClick={() => service.run()} className="battle-modal-action-btn">
							Run Away
						</button>
					</div>
				)}
				{isMe && !battle.battleActive && battle.monsterHealth <= 0 && (
					<div className="battle-modal-center">
						<button
							onClick={() => {
								service.collectLoot();
								onClose();
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
								onClose();
							}}
							className="battle-modal-action-btn"
						>
							Return to Town
						</button>
					</div>
				)}
				{!isMe && (
					<div className="battle-modal-center">
						<button onClick={onClose}>Close</button>
					</div>
				)}
			</div>
		</div>
	);
});

export default BattleModal;
