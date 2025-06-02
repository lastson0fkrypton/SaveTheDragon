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
			<h3>Players</h3>
			<ul className="player-list">
				{gameState.players.map((p: any, idx: number) => {
					const hearts = Math.max(1, (p.maxHearts || 5) - (p.damage || 0));
					return (
						<li
							className={['player-list-item', idx === gameState.currentTurn ? 'current-turn' : ''].join(
								' '
							)}
							key={p.id}
						>
							<CachedImage
								className="player-character-pic"
								src={
									player.characterId ? `/characters/${player.characterId}.png` : '/items/nothing.png'
								}
								alt="character"
							/>
							<div className="player-name" title={p.name}>
								{p.name}
							</div>
							<div className="player-hearts">
								{Array.from({ length: p.maxHearts || 5 }, (_, i) => {
									const heartOpacity = i < hearts ? 1 : 0.2;
									return (
										<CachedImage
											src="/icons/Heart.png"
											key={p.id + '_' + i}
											style={{
												width: '16px',
												height: '16px',
												verticalAlign: 'middle',
												marginLeft: '2px',
												opacity: heartOpacity,
											}}
											alt="♥"
										/>
									);
								})}
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
