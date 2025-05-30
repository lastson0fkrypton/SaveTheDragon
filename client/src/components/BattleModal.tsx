import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

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

	return (
		<div className="modal">
			<div className="modal-window">
				<h2>Battle!</h2>
				<div className="battle-modal-flex">
					<div className="battle-modal-side">
						<div className="battle-panel card">
							<div className="floating-hearts">
								{Array.from({ length: player?.maxHearts || 0 }, (_, i) => (
									<img
										key={i}
										src="/heart.svg"
										alt="heart"
										style={{
											opacity: i < (player?.maxHearts || 0) - (player?.damage || 0) ? 1 : 0.2,
										}}
										className="battle-modal-heart"
									/>
								))}
							</div>
							<img
								src={
									player?.characterId ? `/characters/${player.characterId}.png` : '/items/nothing.png'
								}
								alt={player?.name}
								className="card-image"
							/>
							<div className="card-overlay">
								<div className="card-name">{player?.name}</div>
								<div className="stat attack">88</div>
								<div className="stat defense">88</div>
								<div className="stat health">88</div>
								<div className={'stat attackchance chance chance70'}>
									<div>hit</div>
									<div>miss</div>
								</div>
								<div className={'stat defensechance chance chance70'}>
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
								{Array.from({ length: monster?.maxHearts || 0 }, (_, i) => (
									<img
										key={i}
										src="/heart.svg"
										alt="heart"
										style={{
											opacity: i < (player?.maxHearts || 0) - (player?.damage || 0) ? 1 : 0.2,
										}}
										className="battle-modal-heart"
									/>
								))}
							</div>
							<img
								src={`/monsters/${monster?.img || 'nothing.png'}`}
								alt={monster?.name}
								className="card-image"
							/>
							<div className="card-overlay">
								<div className="card-name">{monster?.name}</div>
								<div className="stat attack">9</div>
								<div className="stat defense">9</div>
								<div className="stat health">9</div>
								<div className={'stat attackchance chance chance70'}>
									<div>hit</div>
									<div>miss</div>
								</div>
								<div className={'stat defensechance chance chance70'}>
									<div>block</div>
									<div>hit</div>
								</div>
							</div>
						</div>
						{/*             
            <div className="battle-modal-hearts">
            {Array.from({ length: (monster?.defense * 2) || 0 }, (_, i) => (
                <img
                    key={i}
                    src="/heart.svg"
                    alt="heart"
                    style={{ opacity: (i < (monster?.defense * 2)-battle.monsterHealth) ? 1 : 0.2 }}
                    className="battle-modal-heart"
                />
            ))}
            </div> */}
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
