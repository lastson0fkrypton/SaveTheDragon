import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import type { RecentAction } from '../../types';

const QuestPanel: React.FC = observer(() => {
	const state = getAppState();
	const [tab, setTab] = useState<'log' | 'quests'>('log');
	const logListRef = useRef<HTMLUListElement>(null);

	const gameState = state.gameState;
	const playerId = state.playerId;

	// Game log (recentActions)
	const gameLog = gameState?.recentActions || [];
	const [lastGameLog, setLastGameLog] = useState<RecentAction[]>([]);

	const gameLogOutOfDate = () => {
		//check if game log is same as lastGameLog?
		for (let i = 0; i < gameLog.length; i++) {
			if (gameLog[i].id !== lastGameLog[i]?.id) {
				return true;
			}
		}
		return false;
	};
	useEffect(() => {
		if (tab === 'log' && logListRef.current && gameLogOutOfDate()) {
			logListRef.current.scrollTop = logListRef.current.scrollHeight;
			setLastGameLog(gameLog);
		}
	}, [gameLog, tab]);

	if (!gameState || !playerId) return null;

	const getActionMessage = (action: RecentAction): string => {
		switch (action.type) {
			case 'battle-end':
				return action.playerName + ' ' + action.itemName + '.';
			case 'equip':
				return action.playerName + ' equipped ' + action.itemName + '.';
			case 'use-item':
				return action.playerName + ' used ' + action.itemName + '.';
			case 'visit-town':
				return action.playerName + ' rested at a town.';
			default:
				return action.playerName + ' ' + action.itemName + '.';
		}
	};
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
						<ul className="game-log-list" ref={logListRef}>
							{gameLog.length === 0 && <li>No recent actions yet.</li>}
							{gameLog.map((action: any) => (
								<li key={action.id}>{getActionMessage(action)}</li>
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
