import React, { useState } from 'react';

import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import { CachedImage } from '../common/CachedImage';
import GameModal from '../modals/GameModal';

const GamePanel: React.FC = observer(() => {
	const state = getAppState();

	const gameState = state.gameState;
	const playerId = state.playerId;

	if (!gameState || !playerId) return null;
	const player = gameState.players.find(p => p.id === playerId);

	if (!player) return null;

	const [showGameModal, setShowGameModal] = useState(false);

	return (
		<div className="player-panel game-panel">
			<button onClick={() => setShowGameModal(true)}>Main Menu</button>
			{gameState.raidBoss && !gameState.raidBoss.defeated && (
				<div style={{ marginTop: 8, marginBottom: 8, fontSize: 12, color: '#ffb3b3' }}>
					Boss: {gameState.raidBoss.name} {gameState.raidBoss.currentHealth}/{gameState.raidBoss.maxHealth} HP
				</div>
			)}
			{gameState.gameCompletion?.completed && (
				<div style={{ marginTop: 8, marginBottom: 8, fontSize: 12, color: '#7fff7f', fontWeight: 700 }}>
					Victory! {gameState.gameCompletion.completedByPlayerName || 'Players'} defeated the Evil Princess.
				</div>
			)}
			<h3>Players</h3>
			<ul className="player-list">
				{gameState.players.map((p: any, idx: number) => {
					const hearts = Math.max(0, (p.maxHearts || 5) - (p.damage || 0));
					const equippedWeaponId = p.inventory?.equippedWeaponId || 'fist';
					const equippedArmorId = p.inventory?.equippedArmorId || '';
					const attack = gameState.itemMeta?.[equippedWeaponId]?.attack || 1;
					const defense = gameState.itemMeta?.[equippedArmorId]?.defense || 0;
					return (
						<li
							className={['player-list-item', idx === gameState.currentTurn ? 'current-turn' : ''].join(
								' '
							)}
							key={p.id}
						>
							<CachedImage
								className="player-character-pic"
								src={p.characterId ? `/characters/${p.characterId}.png` : '/items/nothing.png'}
								alt="character"
							/>
							<div className="player-name" title={p.name}>
								{p.name}
							</div>
							<div className="player-stats">
								<div className="stat-icon-badge player-list-health-badge">
									<CachedImage src="/icons/health.png" alt="Health" className="stat-icon" />
									<span className="stat-icon-value">{hearts}</span>
								</div>
								<div className="stat-icon-badge player-list-attack-badge">
									<CachedImage src="/icons/sword.png" alt="Attack" className="stat-icon" />
									<span className="stat-icon-value">{attack}</span>
								</div>
								<div className="stat-icon-badge player-list-defense-badge">
									<CachedImage src="/icons/shield.png" alt="Defense" className="stat-icon" />
									<span className="stat-icon-value">{defense}</span>
								</div>
							</div>
						</li>
					);
				})}
			</ul>
			{showGameModal && (
				<GameModal
					onClose={() => {
						setShowGameModal(false);
					}}
				/>
			)}
		</div>
	);
});

export default GamePanel;
