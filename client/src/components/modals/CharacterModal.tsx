import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import type { Character } from '../../types';
import { CachedImage } from '../common/CachedImage';

const CharacterModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
	const state = getAppState();
	const service = state.service;

	const gameState = state.gameState;
	const playerId = state.playerId;
	if (!gameState || !playerId) return null;
	const player = gameState.players.find(p => p.id === playerId);
	if (!player) return null;

	const [characters, setCharacters] = useState<Character[]>([]);
	useEffect(() => {
		service.fetchCharacters().then(setCharacters);
	}, []);
	return (
		<div className="modal">
			<div className="modal-window">
				<h2>Change your Character</h2>
				<div className="inventory">
					{characters.map(char => {
						return (
							<button
								key={char.id}
								className={'card ' + (char.id === player.characterId ? 'equipped' : '')}
								onClick={() => {
									if (char.id !== player.characterId) {
										service.updateCharacter(char.id);
									}
									onClose();
								}}
							>
								<CachedImage
									src={`/characters/${char.id}.png`}
									alt={char.description}
									className="card-image"
								/>
								<div className="card-overlay">
									<div className="card-name"></div>
									<div className="card-desc">{char.description}</div>
								</div>
							</button>
						);
					})}
				</div>
				<button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px' }}>
					Close
				</button>
			</div>
		</div>
	);
});

export default CharacterModal;
