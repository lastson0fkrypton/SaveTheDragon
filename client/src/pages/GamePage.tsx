import React, { useEffect, useState } from 'react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { getAppState } from '../stores/AppState';
import GameBoard from '../components/GameBoard';
import GamePanel from '../components/overlays/GamePanel';
import Toasts from '../components/Toasts';
import BattleModal from '../components/modals/BattleModal';
import LootModal from '../components/modals/LootModal';
import QuestPanel from '../components/overlays/QuestPanel';
import ItemPanel from '../components/overlays/ItemPanel';
import CharacterPanel from '../components/overlays/CharacterPanel';
import DicePanel from '../components/overlays/DicePanel';

const GamePage: React.FC = observer(() => {
	const state = getAppState();
	const service = state.service;
	const navigate = useNavigate();

	let watchGameStateInterval: any;
	useEffect(() => {
		clearInterval(watchGameStateInterval);
		watchGameStateInterval = setInterval(async () => {
			if (!state.gameId) return;
			const newState = await service.fetchGameState(state.gameId);
			runInAction(() => {
				state.setGameState(newState);
			});
		}, 1000);
		return () => {
			clearInterval(watchGameStateInterval);
		};
	}, []);

	const [showLootModal, setShowLootModal] = useState(false);
	const [showBattleModal, setShowBattleModal] = useState(false);

	// Show modals based on game state
	useEffect(() => {
		if (state.gameState?.currentBattle) setShowBattleModal(true);
		else setShowBattleModal(false);
		if (state.gameState?.recentlyFoundItem) setShowLootModal(true);
		else setShowLootModal(false);
	}, [state.gameState]);

	if (!state.gameId || !state.playerId) {
		return (
			<div style={{ padding: 40, textAlign: 'center' }}>
				<h1>Game not found</h1>
				<p>Please create or join a game first.</p>
				<button onClick={() => navigate('/')}>Go to Home</button>
			</div>
		);
	}
	if (!state.gameState) {
		return <div style={{ padding: 40, textAlign: 'center' }}>Loading game...</div>;
	}
	return (
		<div className="game-ui" style={{ width: '100%', height: '100%' }}>
			<GameBoard />
			<GamePanel />
			<QuestPanel />
			<CharacterPanel />
			<ItemPanel />
			<DicePanel />

			<Toasts />
			{showBattleModal && (
				<BattleModal
					onClose={() => {
						setShowBattleModal(false);
					}}
				/>
			)}
			{showLootModal && (
				<LootModal
					onClose={() => {
						setShowLootModal(false);
					}}
				/>
			)}
		</div>
	);
});

export default GamePage;
