import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react';
import { getAppState } from '../stores/AppState';

interface AdminPageProps {
}

const AdminPage: React.FC<AdminPageProps> = observer(() => {
  const state = getAppState();
  const service = state.service;

  const navigate = useNavigate();

  const [password, setPassword] = useState('');

  let watchGamesInterval: any;

  const handleDelete = async (gameId: string) => {
    if (window.confirm('Are you sure you want to delete this game?')) {
      await service.deleteAdminGame(gameId, state.adminPassword);
      service.fetchAdminGames(state.adminPassword);
    }
  };

  const handleBack = () => {
    clearInterval(watchGamesInterval);
    state.setAdminError('');
    navigate('/');
  };

  const handleLogout = () => {
    clearInterval(watchGamesInterval);
    state.setAdminError('');
    state.setAdminPassword('');
    state.setAdminLoggedIn(false);
    navigate('/');
  };

  useEffect(() => {
    clearInterval(watchGamesInterval);
    watchGamesInterval = setInterval(async () => {
      if (state.adminLoggedIn && state.adminPassword.length > 0) {
        await service.fetchAdminGames(state.adminPassword);
      }
    }, 1000);
    return () => {
      clearInterval(watchGamesInterval);
    }
  }, [state.adminLoggedIn, state.adminPassword]);

  if (!state.adminLoggedIn) {
    return (
      <div style={{ maxWidth: 400, margin: '60px auto', background: '#23234a', color: '#fff', borderRadius: 16, padding: 32 }}>
        <h2>Admin Login</h2>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={{ width: '100%', marginBottom: 8 }} />
        <button onClick={() => service.fetchAdminGames(password)} style={{ width: '100%' }}>Login</button>
        {state.adminError && <div style={{ color: 'red', marginTop: 8 }}>{state.adminError}</div>}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={handleBack} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8 }}>Back</button>
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
          {state.adminGames.map(g => (
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
        <button onClick={handleBack} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8, marginRight: '20px' }}>Back</button>
        <button onClick={handleLogout} style={{ background: '#F44', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8 }}>Logout</button>
      </div>
    </div>
  );
});

export default AdminPage;
