import React, { useState } from 'react';

interface AdminGame {
  gameId: string;
  players: { id: string; name: string }[];
  currentTurn: string | null;
  currentDiceRoll: number | null;
}

interface AdminPageProps {
  onBack: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onBack }) => {
  const [password, setPassword] = useState('');
  const [games, setGames] = useState<AdminGame[]>([]);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const fetchGames = async (pw: string) => {
    setError('');
    const res = await fetch(`/api/admin/games?password=${encodeURIComponent(pw)}`);
    if (!res.ok) {
      setError('Incorrect password or forbidden');
      return;
    }
    setLoggedIn(true);
    setGames(await res.json());
  };

  const handleDelete = async (gameId: string) => {
    if (!window.confirm('Delete this game?')) return;
    await fetch(`/api/admin/games/${gameId}?password=${encodeURIComponent(password)}`, { method: 'DELETE' });
    fetchGames(password);
  };

  if (!loggedIn) {
    return (
      <div style={{ maxWidth: 400, margin: '60px auto', background: '#23234a', color: '#fff', borderRadius: 16, padding: 32 }}>
        <h2>Admin Login</h2>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={{ width: '100%', marginBottom: 8 }} />
        <button onClick={() => fetchGames(password)} style={{ width: '100%' }}>Login</button>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={onBack} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8 }}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '60px auto', background: '#23234a', color: '#fff', borderRadius: 16, padding: 32 }}>
      <h2>Admin - Active Games</h2>
      <table style={{ width: '100%', marginTop: 16, background: '#222', borderRadius: 8 }}>
        <thead>
          <tr style={{ background: '#333' }}>
            <th>Game ID</th>
            <th>Players</th>
            <th>Current Turn</th>
            <th>Dice Roll</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {games.map(g => (
            <tr key={g.gameId}>
              <td>{g.gameId}</td>
              <td>{g.players.map(p => p.name).join(', ')}</td>
              <td>{g.currentTurn || 'N/A'}</td>
              <td>{g.currentDiceRoll || 'N/A'}</td>
              <td><button onClick={() => handleDelete(g.gameId)} style={{ background: '#e44', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px' }}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button onClick={onBack} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8 }}>Back</button>
      </div>
    </div>
  );
};

export default AdminPage;
