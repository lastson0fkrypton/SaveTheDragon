import React, { useEffect, useState } from 'react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { getAppState } from '../stores/AppState';
import GameBoard from '../components/GameBoard';
import PlayerPanel from '../components/PlayerPanel';
import StatusBar from '../components/StatusBar';
import Inventory from '../components/Inventory';
import Toasts from '../components/Toasts';
import BattleModal from '../components/BattleModal';
import LootModal from '../components/LootModal';
import ProfilePicModal from '../components/ProfilePicModal';

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
    }
  }, []);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLootModal, setShowLootModal] = useState(false);
  const [showBattleModal, setShowBattleModal] = useState(false);

  // Show modals based on game state
  useEffect(() => {
    if (state.gameState?.currentBattle) setShowBattleModal(true);
    else setShowBattleModal(false);
    if (state.gameState?.recentlyFoundItem) setShowLootModal(true);
    else setShowLootModal(false);
  }, [state.gameState]);

  const handleRoll = async () => {
    await state.service.rollDice();
  };

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
    <div className="game-root" style={{ background: '#181818', height:'100%', width:'100%', color: '#fff' }}>
      <StatusBar />
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'flex-start' }}>
        <div>
          <PlayerPanel />
          <button onClick={() => setShowProfileModal(true)} style={{ marginBottom: 8 }}>Change Profile Picture</button>
          <Inventory />
        </div>
        <div>
          <GameBoard />
          {state.gameState.players[state.gameState.currentTurn]?.id === state.playerId && !state.gameState.currentDiceRoll && (
            <button onClick={handleRoll} style={{ marginTop: 16, width: 200, height: 48, fontSize: 20 }}>Roll Dice</button>
          )}
        </div>
      </div>
      <Toasts />
      {showBattleModal && (
        <BattleModal />
      )}
      {showLootModal && (
        <LootModal />
      )}
      {showProfileModal && (
        <ProfilePicModal />
      )}
    </div>
  );
});

export default GamePage;
