import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';

const QuestPanel: React.FC = observer(() => {
	const state = getAppState();
	const gameState = state.gameState;
	const playerId = state.playerId;
	const [tab, setTab] = useState<'log' | 'quests'>('log');

	if (!gameState || !playerId) return null;

	// Game log (recentActions)
	const gameLog = (gameState.recentActions || []).slice().reverse();

	return (
		<div className="quest-panel game-panel">
			<div className="quest-tabs">
				<button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>
					Quest Log
				</button>
				<button className={tab === 'quests' ? 'active' : ''} onClick={() => setTab('quests')}>
					Quests
				</button>
			</div>
			<div className="quest-tab-content">
				{tab === 'log' && (
					<div className="quest-log">
						<h3>Game Log</h3>
						<ul className="game-log-list">
							{gameLog.length === 0 && <li>No recent actions yet.</li>}
							{gameLog.map((action: any) => (
								<li key={action.id}>
									<span className="log-time">{new Date(action.ts).toLocaleTimeString()}</span>{' '}
									<span className="log-player">{action.playerName}</span>{' '}
									<span className="log-type">{action.type}</span>{' '}
									<span className="log-item">{action.itemName}</span>
								</li>
							))}
						</ul>
					</div>
				)}
				{tab === 'quests' && (
					<div className="quest-list">
						<h3>Quests</h3>
						<p>Quest checklist and completed quests will appear here.</p>
						{/* TODO: Add quest checklist and completion UI */}
					</div>
				)}
			</div>
		</div>
	);
});

export default QuestPanel;
