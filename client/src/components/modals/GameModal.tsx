import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import { useNavigate } from 'react-router-dom';

const GameModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
	const state = getAppState();
	const navigate = useNavigate();

	return (
		<div className="modal">
			<div className="modal-window">
				<div className="modal-background-image"></div>
				<h2>Main Menu</h2>
				<div className="main-menu-buttons">
					<h2 className="game-id">Game ID: {state.gameId}</h2>
					<button
						onClick={() => {
							navigate('/');
						}}
						style={{ padding: '8px 24px', backgroundColor: '#800' }}
					>
						Quit Game
					</button>
				</div>
				<button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px' }}>
					Close
				</button>
			</div>
		</div>
	);
});

export default GameModal;
