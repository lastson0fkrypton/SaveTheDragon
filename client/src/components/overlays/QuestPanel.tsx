import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../../stores/AppState';
import type { QuestInstance, RecentAction } from '../../types';

const QuestPanel: React.FC = observer(() => {
	const state = getAppState();
	const [tab, setTab] = useState<'log' | 'quests'>('log');
	const logListRef = useRef<HTMLUListElement>(null);

	const gameState = state.gameState;
	const playerId = state.playerId;
	const isMyTurn = gameState?.players?.[gameState.currentTurn]?.id === playerId;
	const myQuestState = playerId ? gameState?.questSystem?.players?.[playerId] : null;
	const activeQuests = myQuestState?.active || [];
	const completedQuests = myQuestState?.completed || [];
	const pendingOffer = isMyTurn ? myQuestState?.pendingQuestOffer : null;

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
			case 'discard-item':
				return action.playerName + ' discarded ' + action.itemName + '.';
			case 'visit-town':
				return action.playerName + ' rested at a town.';
			case 'quest-accepted':
				return action.playerName + ' accepted quest: ' + action.itemName + '.';
			case 'quest-rejected':
				return action.playerName + ' rejected quest: ' + action.itemName + '.';
			case 'quest-abandoned':
				return action.playerName + ' abandoned quest: ' + action.itemName + '.';
			case 'quest-complete':
				return action.playerName + ' completed quest: ' + action.itemName + '.';
			default:
				return action.playerName + ' ' + action.itemName + '.';
		}
	};

	const renderQuestCard = (quest: QuestInstance, showAbandon = false) => {
		const checklist = quest.objectiveChecklist || [];
		return (
			<li key={quest.instanceId} className="quest-entry">
				<div className="quest-entry-header">
					<strong>{quest.title}</strong>
					<span className={`quest-difficulty quest-${quest.difficulty}`}>{quest.difficulty}</span>
					{showAbandon && (
						<button
							className="quest-abandon"
							onClick={async () => {
								const confirmed = window.confirm('Are you sure you wish to abandon quest?');
								if (!confirmed) return;
								await state.service.abandonQuest(quest.instanceId);
							}}
						>
							X
						</button>
					)}
				</div>
				<div>{quest.description}</div>
				{checklist.length > 0 && (
					<ul>
						{checklist.map((item, index) => (
							<li key={`${quest.instanceId}-objective-${index}`}>
								<label>
									<input type="checkbox" checked={item.checked} readOnly /> {item.label}
								</label>
							</li>
						))}
					</ul>
				)}
				<div className="quest-progress">{quest.progressLabel}</div>
				<div className="quest-reward">Reward: +{quest.rewardHearts} Additional Heart</div>
			</li>
		);
	};

	return (
		<div className="quest-panel game-panel">
			{pendingOffer && (
				<div className="quest-offer">
					<div className="quest-entry-header">
						<strong>{pendingOffer.title}</strong>
						<span className={`quest-difficulty quest-${pendingOffer.difficulty}`}>{pendingOffer.difficulty}</span>
					</div>
					<div>{pendingOffer.description}</div>
					{Array.isArray(pendingOffer.objectiveChecklist) && pendingOffer.objectiveChecklist.length > 0 && (
						<ul>
							{pendingOffer.objectiveChecklist.map((item, index) => (
								<li key={`offer-objective-${index}`}>
									<label>
										<input type="checkbox" checked={false} readOnly /> {item.label}
									</label>
								</li>
							))}
						</ul>
					)}
					<div className="quest-reward">Reward: +{pendingOffer.rewardHearts} Additional Heart</div>
					<div className="quest-offer-actions">
						<button onClick={() => state.service.respondToQuestOffer('accept')} disabled={activeQuests.length >= 5}>
							Accept
						</button>
						<button onClick={() => state.service.respondToQuestOffer('reject')}>Reject</button>
					</div>
				</div>
			)}
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
						<div className="quest-capacity">Active: {activeQuests.length}/5</div>
						<h4>Active Quests</h4>
						<ul className="quest-listing">
							{activeQuests.length === 0 && <li>No active quests.</li>}
							{activeQuests.map(quest => renderQuestCard(quest, true))}
						</ul>
						<h4>Completed Quests</h4>
						<ul className="quest-listing">
							{completedQuests.length === 0 && <li>No completed quests yet.</li>}
							{completedQuests.map(quest => renderQuestCard(quest, false))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
});

export default QuestPanel;
