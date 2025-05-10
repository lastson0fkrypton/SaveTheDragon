import React, { useEffect, useState } from 'react';
import type { GameState } from './types';
import GameBoard from './components/GameBoard';
import PlayerPanel from './components/PlayerPanel';
import StatusBar from './components/StatusBar';
import Inventory from './components/Inventory';
import Toasts from './components/Toasts';
import HomePage from './components/HomePage';
import AdminPage from './components/AdminPage';
import BattleModal from './components/BattleModal';
import LootModal from './components/LootModal';
import ProfilePicModal from './components/ProfilePicModal';

type Page = 'home' | 'admin' | 'game';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('home');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLootModal, setShowLootModal] = useState(false);
  const [showBattleModal, setShowBattleModal] = useState(false);

  // Navigation handlers
  const goHome = () => setPage('home');
  const goAdmin = () => setPage('admin');
  const goGame = () => setPage('game');

  // --- API Calls ---
  const createGame = async (playerName: string, gridSizeX: number, gridSizeY: number) => {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gridSizeX, gridSizeY })
    });
    const data = await res.json();
    const gid = data.gameId;
    const joinRes = await fetch(`/api/games/${gid}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName })
    });
    const joinData = await joinRes.json();
    setPlayerId(joinData.playerId);
    setGameId(gid);
    localStorage.setItem('playerId', joinData.playerId);
    localStorage.setItem('gameId', gid);
    goGame();
  };

  const joinGame = async (gid: string, playerName: string) => {
    const joinRes = await fetch(`/api/games/${gid}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName })
    });
    const joinData = await joinRes.json();
    setPlayerId(joinData.playerId);
    setGameId(gid);
    localStorage.setItem('playerId', joinData.playerId);
    localStorage.setItem('gameId', gid);
    goGame();
  };

  // Reconnect if localStorage has info
  useEffect(() => {
    // const pid = localStorage.getItem('playerId') || '';
    // const gid = localStorage.getItem('gameId') || '';
    // if (gid && pid) {
    //   setPlayerId(pid);
    //   setGameId(gid);
    //   goGame();
    // }
  }, []);

  // Poll for game state
  useEffect(() => {
    if (!gameId || page !== 'game') return;
    let stopped = false;
    const poll = async () => {
      const res = await fetch(`/api/games/${gameId}/state`);
      if (res.ok) {
        const state = await res.json();
        setGameState(state);
      }
      if (!stopped) setTimeout(poll, 1500);
    };
    poll();
    return () => { stopped = true; };
  }, [gameId, page]);

  // Show modals based on game state
  useEffect(() => {
    if (gameState?.currentBattle) setShowBattleModal(true);
    else setShowBattleModal(false);
    if (gameState?.recentlyFoundItem) setShowLootModal(true);
    else setShowLootModal(false);
  }, [gameState]);

  // --- Game action handlers ---
  const handleCellClick = async (x: number, y: number) => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, targetX: x, targetY: y })
    });
  };
  const handleRoll = async () => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    });
  };
  const handleEquip = async (itemId: string) => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/player/${playerId}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId })
    });
  };
  const handleUseItem = async (itemId: string) => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/player/${playerId}/use-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId })
    });
  };

  // --- Battle modal handlers ---
  const handleAttack = async () => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/battle/attack`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId })
    });
  };
  const handleRun = async () => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/battle/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId })
    });
  };
  const handleCollectLoot = async () => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/battle/collect-loot`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId })
    });
    setShowBattleModal(false);
  };
  const handleReturnToTown = async () => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/battle/return-to-town`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId })
    });
    setShowBattleModal(false);
  };

  // --- Profile picture modal handler ---
  const handleProfilePicSelect = async (pic: string) => {
    if (!gameId || !playerId) return;
    await fetch(`/api/games/${gameId}/player/${playerId}/profile-pic`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profilePic: pic })
    });
    setShowProfileModal(false);
  };

  // --- Render ---
  if (page === 'admin') {
    return <AdminPage onBack={goHome} />;
  }
  if (page === 'game') {
    if (!gameState || !playerId) {
      return <div style={{ padding: 40, textAlign: 'center' }}>Loading game...</div>;
    }
    return (
      <div className="app-root" style={{ background: '#181818', minHeight: '100vh', color: '#fff' }}>
        <StatusBar gameState={gameState} playerId={playerId} />
        <button onClick={goHome} style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>Home</button>
        <div style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'flex-start' }}>
          <div>
            <PlayerPanel gameState={gameState} playerId={playerId} />
            <button onClick={() => setShowProfileModal(true)} style={{ marginBottom: 8 }}>Change Profile Picture</button>
            <Inventory gameState={gameState} playerId={playerId} onEquip={handleEquip} onUseItem={handleUseItem} />
          </div>
          <div>
            <GameBoard gameState={gameState} onCellClick={handleCellClick} />
            {gameState.players[gameState.currentTurn]?.id === playerId && !gameState.currentDiceRoll && (
              <button onClick={handleRoll} style={{ marginTop: 16, width: 200, height: 48, fontSize: 20 }}>Roll Dice</button>
            )}
          </div>
        </div>
        <Toasts gameState={gameState} />
        {showBattleModal && gameState && (
          <BattleModal
            gameState={gameState}
            playerId={playerId}
            onAttack={handleAttack}
            onRun={handleRun}
            onCollectLoot={handleCollectLoot}
            onReturnToTown={handleReturnToTown}
            onClose={() => setShowBattleModal(false)}
          />
        )}
        {showLootModal && gameState && (
          <LootModal gameState={gameState} playerId={playerId} onClose={() => setShowLootModal(false)} />
        )}
        {showProfileModal && (
          <ProfilePicModal onSelect={handleProfilePicSelect} onClose={() => setShowProfileModal(false)} />
        )}
      </div>
    )
  }
  return <HomePage onCreate={createGame} onJoin={joinGame} onAdmin={goAdmin} />;
};

export default App;
