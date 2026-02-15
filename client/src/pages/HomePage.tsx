import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAppState } from '../stores/AppState';

const HomePage: React.FC = observer(() => {
  const state = getAppState();
  const service = state.service;
  const navigate = useNavigate();
  const location = useLocation();
  const [playerNameNew, setPlayerNameNew] = useState('');
  const [gridSizeX, setGridSizeX] = useState(10);
  const [gridSizeY, setGridSizeY] = useState(10);
  const [gameId, setGameId] = useState('');
  const [playerNameJoin, setPlayerNameJoin] = useState('');
  const [showExpiredMessage, setShowExpiredMessage] = useState(
    !!(location.state as { sessionExpired?: boolean } | null)?.sessionExpired
  );

  React.useEffect(() => {
    const sessionExpired = !!(location.state as { sessionExpired?: boolean } | null)?.sessionExpired;
    if (sessionExpired) {
      setShowExpiredMessage(true);
    }
  }, [location.state]);

  React.useEffect(() => {
    if (state.gameId && state.playerName) {
      navigate('/game');
    }
  }, [navigate, state.gameId, state.playerName]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await service.createGame(playerNameNew, gridSizeX, gridSizeY);
    navigate('/game');
  };
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    await service.joinGame(gameId, playerNameJoin);
    navigate('/game');
  };

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px #0008' }}>
      {showExpiredMessage && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#3d2b2b', border: '1px solid #8a4a4a' }}>
          <div style={{ marginBottom: 8 }}>Your game expired or no longer exists.</div>
          <button
            onClick={() => {
              setShowExpiredMessage(false);
              navigate('/', { replace: true, state: {} });
            }}
            style={{ width: '100%' }}
          >
            Return Home
          </button>
        </div>
      )}
      <img src="/ai-pictures/baby_dragon.png" alt="Baby Dragon" style={{ display: 'block', margin: '0 auto 24px', width: 120, height: 120 }} />
      <h1 style={{ textAlign: 'center', marginBottom: 32 }}>Save the Dragon</h1>
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
        <form onSubmit={handleCreate} style={{ flex: 1 }}>
          <h2>New Game</h2>
          <input value={playerNameNew} onChange={e => setPlayerNameNew(e.target.value)} placeholder="Your Name" required style={{ width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="number" min={10} max={100} value={gridSizeX} onChange={e => setGridSizeX(Number(e.target.value))} style={{ width: 80 }} />
            <input type="number" min={10} max={100} value={gridSizeY} onChange={e => setGridSizeY(Number(e.target.value))} style={{ width: 80 }} />
          </div>
          <button type="submit" style={{ width: '100%' }}>Start New Game</button>
        </form>
        <form onSubmit={handleJoin} style={{ flex: 1 }}>
          <h2>Join Game</h2>
          <input value={gameId} onChange={e => setGameId(e.target.value)} placeholder="Game ID" required style={{ width: '100%', marginBottom: 8 }} />
          <input value={playerNameJoin} onChange={e => setPlayerNameJoin(e.target.value)} placeholder="Your Name" required style={{ width: '100%', marginBottom: 8 }} />
          <button type="submit" style={{ width: '100%' }}>Join Game</button>
        </form>
      </div>
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button onClick={() => navigate('/admin')} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8 }}>Admin</button>
      </div>
    </div>
  );
});

export default HomePage;
