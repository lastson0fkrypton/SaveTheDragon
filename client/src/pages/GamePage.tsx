import React, { useEffect, useState } from 'react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { getAppState } from '../stores/AppState';
import GameBoard from '../components/GameBoard';
import GamePanel from '../components/overlays/GamePanel';
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
	const [bootstrapped, setBootstrapped] = useState(false);
	const [sessionExpired, setSessionExpired] = useState(false);

	let watchGameStateInterval: any;

	useEffect(() => {
		let cancelled = false;
		const bootstrapSession = async () => {
			if (!state.gameId) {
				state.reset();
				if (!cancelled) {
					setSessionExpired(true);
					setBootstrapped(true);
				}
				return;
			}

			if (!state.playerName) {
				state.reset();
				if (!cancelled) {
					setSessionExpired(true);
					setBootstrapped(true);
				}
				return;
			}

			const restored = await service.reconnectSavedSession(state.gameId, state.playerName);
			if (!restored) {
				state.reset();
				if (!cancelled) {
					setSessionExpired(true);
					setBootstrapped(true);
				}
				return;
			}

			if (!cancelled) setBootstrapped(true);
		};

		bootstrapSession();
		return () => {
			cancelled = true;
		};
	}, [service, state]);

	useEffect(() => {
		if (!bootstrapped) return;
		clearInterval(watchGameStateInterval);
		watchGameStateInterval = setInterval(async () => {
			if (!state.gameId) return;
			const newState = await service.fetchGameState(state.gameId);
			if (!newState) {
				clearInterval(watchGameStateInterval);
				state.reset();
				setSessionExpired(true);
				return;
			}
			runInAction(() => {
				state.setGameState(newState);
			});
		}, 1000);
		return () => {
			clearInterval(watchGameStateInterval);
		};
	}, [bootstrapped, service, state]);

	const [showLootModal, setShowLootModal] = useState(false);
	const [showBattleModal, setShowBattleModal] = useState(false);

	// Show modals based on game state
	useEffect(() => {
		if (state.gameState?.currentBattle) setShowBattleModal(true);
		if (state.gameState?.recentlyFoundItem) setShowLootModal(true);
	}, [state.gameState]);

	if (!bootstrapped) {
		return <div style={{ padding: 40, textAlign: 'center' }}>Restoring saved session...</div>;
	}
	if (sessionExpired) {
		return (
			<div style={{ padding: 40, textAlign: 'center' }}>
				<h1>Game expired</h1>
				<p>This game no longer exists or your session has expired.</p>
				<button onClick={() => navigate('/', { replace: true })}>
					Return Home
				</button>
			</div>
		);
	}
	if (!state.gameId) {
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

			<div className="character-bar">
				<ItemPanel />
				<CharacterPanel />
				<DicePanel />
			</div>

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
