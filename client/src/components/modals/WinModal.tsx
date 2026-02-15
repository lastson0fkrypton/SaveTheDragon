import React from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { getAppState } from '../../stores/AppState';

const WinModal: React.FC = observer(() => {
	const state = getAppState();
	const navigate = useNavigate();
	const completion = state.gameState?.gameCompletion;
	const playerNames = (state.gameState?.players || []).map(player => player.name).filter(Boolean);

	if (!completion?.completed) return null;

	const formatNames = (names: string[]) => {
		if (names.length === 0) return 'The heroes';
		if (names.length === 1) return names[0];
		if (names.length === 2) return `${names[0]} and ${names[1]}`;
		return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
	};

	const heroNames = formatNames(playerNames);

	return (
		<div className="modal">
			<div className="modal-window">
				<div className="modal-background-image"></div>
				<h2>Victory!</h2>
				<img
					src="/ai-pictures/happy_dragon.png"
					alt="Happy Dragon"
					style={{ display: 'block', margin: '0 auto 12px', width: 140, height: 140, objectFit: 'contain' }}
					onError={event => {
						event.currentTarget.onerror = null;
						event.currentTarget.src = '/ai-pictures/baby_dragon.png';
					}}
				/>
				<p style={{ marginTop: 12, marginBottom: 8 }}>
					{heroNames} defeated the Evil Princess and <strong>rescued the dragon</strong>!
				</p>
				{completion.completedAtTs && (
					<p style={{ fontSize: 12, opacity: 0.8, marginBottom: 16 }}>
						Completed at {new Date(completion.completedAtTs).toLocaleTimeString()}
					</p>
				)}
				<div className="battle-modal-actions" style={{ marginTop: 16 }}>
					<button
						onClick={() => {
							state.reset();
							navigate('/');
						}}
						className="battle-modal-action-btn"
					>
						Return Home
					</button>
				</div>
			</div>
		</div>
	);
});

export default WinModal;
