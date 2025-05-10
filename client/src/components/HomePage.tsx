import React, { useState } from 'react';

interface HomePageProps {
  onCreate: (playerName: string, gridSizeX: number, gridSizeY: number) => void;
  onJoin: (gameId: string, playerName: string) => void;
  onAdmin: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onCreate, onJoin, onAdmin }) => {
  const [playerNameNew, setPlayerNameNew] = useState('');
  const [gridSizeX, setGridSizeX] = useState(10);
  const [gridSizeY, setGridSizeY] = useState(10);
  const [gameId, setGameId] = useState('');
  const [playerNameJoin, setPlayerNameJoin] = useState('');

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px #0008' }}>
      <h1 style={{ textAlign: 'center', marginBottom: 32 }}>Save the Dragon</h1>
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
        <form onSubmit={e => { e.preventDefault(); onCreate(playerNameNew, gridSizeX, gridSizeY); }} style={{ flex: 1 }}>
          <h2>New Game</h2>
          <input value={playerNameNew} onChange={e => setPlayerNameNew(e.target.value)} placeholder="Your Name" required style={{ width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="number" min={10} max={100} value={gridSizeX} onChange={e => setGridSizeX(Number(e.target.value))} style={{ width: 80 }} />
            <input type="number" min={10} max={100} value={gridSizeY} onChange={e => setGridSizeY(Number(e.target.value))} style={{ width: 80 }} />
          </div>
          <button type="submit" style={{ width: '100%' }}>Start New Game</button>
        </form>
        <form onSubmit={e => { e.preventDefault(); onJoin(gameId, playerNameJoin); }} style={{ flex: 1 }}>
          <h2>Join Game</h2>
          <input value={gameId} onChange={e => setGameId(e.target.value)} placeholder="Game ID" required style={{ width: '100%', marginBottom: 8 }} />
          <input value={playerNameJoin} onChange={e => setPlayerNameJoin(e.target.value)} placeholder="Your Name" required style={{ width: '100%', marginBottom: 8 }} />
          <button type="submit" style={{ width: '100%' }}>Join Game</button>
        </form>
      </div>
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button onClick={onAdmin} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8 }}>Admin</button>
      </div>
    </div>
  );
};

export default HomePage;
