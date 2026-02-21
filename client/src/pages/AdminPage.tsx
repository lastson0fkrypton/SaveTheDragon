import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react';
import { getAppState } from '../stores/AppState';

interface AdminPageProps {
}

type ToastState = {
  message: string;
  type: 'success' | 'error';
} | null;

const AdminPage: React.FC<AdminPageProps> = observer(() => {
  const state = getAppState();
  const service = state.service;

  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [selectedItemByPlayerId, setSelectedItemByPlayerId] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const refreshGames = async () => {
    if (!state.adminPassword) return;
    await service.fetchAdminGames(state.adminPassword);
  };

  const handleDelete = async (gameId: string) => {
    if (window.confirm('Are you sure you want to delete this game?')) {
      try {
        await service.deleteAdminGame(gameId, state.adminPassword);
        await refreshGames();
        showToast(`Deleted game ${gameId}`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete game';
        showToast(message, 'error');
      }
    }
  };

  const handleKickPlayer = async (gameId: string, playerId: string, playerName: string) => {
    if (!window.confirm(`Kick ${playerName} from game ${gameId}?`)) return;
    try {
      await service.kickAdminPlayer(gameId, playerId, state.adminPassword);
      await refreshGames();
      showToast(`Kicked ${playerName}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to kick ${playerName}`;
      showToast(message, 'error');
    }
  };

  const handleGiveItem = async (gameId: string, playerId: string) => {
    const itemId = selectedItemByPlayerId[playerId];
    if (!itemId) return;
    const item = state.adminItems.find(i => i.id === itemId);
    try {
      await service.giveAdminPlayerItem(gameId, playerId, itemId, state.adminPassword);
      await refreshGames();
      showToast(`Gave ${item?.name || itemId}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to give item';
      showToast(message, 'error');
    }
  };

  const handlePreventExpiryToggle = async (gameId: string, preventExpiry: boolean) => {
    try {
      await service.setAdminGamePreventExpiry(gameId, preventExpiry, state.adminPassword);
      await refreshGames();
      showToast(preventExpiry ? `Expiry disabled for ${gameId}` : `Expiry enabled for ${gameId}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update expiry setting';
      showToast(message, 'error');
    }
  };

  const handleBack = () => {
    state.setAdminError('');
    navigate('/');
  };

  const handleLogout = () => {
    state.setAdminError('');
    state.setAdminPassword('');
    state.setAdminLoggedIn(false);
    state.setAdminItems([]);
    navigate('/');
  };

  useEffect(() => {
    const watchGamesInterval = setInterval(async () => {
      if (state.adminLoggedIn && state.adminPassword.length > 0) {
        await service.fetchAdminGames(state.adminPassword);
      }
    }, 1000);
    return () => {
      clearInterval(watchGamesInterval);
    };
  }, [state.adminLoggedIn, state.adminPassword, service]);

  useEffect(() => {
    if (!state.adminLoggedIn || !state.adminPassword) return;
    if (state.adminItems.length > 0) return;
    service.fetchAdminItems(state.adminPassword);
  }, [state.adminLoggedIn, state.adminPassword, state.adminItems.length, service]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const groupedAdminItems = state.adminItems.reduce<Record<string, typeof state.adminItems>>((groups, item) => {
    if (!groups[item.group]) {
      groups[item.group] = [];
    }
    groups[item.group].push(item);
    return groups;
  }, {});

  const sortedGroupNames = Object.keys(groupedAdminItems).sort((a, b) => a.localeCompare(b));
  for (const groupName of sortedGroupNames) {
    groupedAdminItems[groupName].sort((a, b) => a.name.localeCompare(b.name));
  }

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
    <div style={{ maxWidth: 1040, margin: '60px auto', background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, position: 'relative' }}>
      <h2>Admin - Active Games</h2>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 18,
            right: 18,
            zIndex: 9999,
            background: toast.type === 'success' ? '#1f7a4d' : '#9d2f2f',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
            maxWidth: 360,
            fontWeight: 600,
          }}
        >
          {toast.message}
        </div>
      )}
      {state.adminGames.length === 0 && (
        <div style={{ marginTop: 16, background: '#222', borderRadius: 8, padding: 16 }}>No active games found.</div>
      )}

      {state.adminGames.map(game => (
        <div key={game.gameId} style={{ marginTop: 16, background: '#222', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Game: {game.gameId}</div>
              <div style={{ opacity: 0.9, marginTop: 4 }}>Current Turn: {game.currentTurn || 'N/A'} | Dice Roll: {game.currentDiceRoll ?? 'N/A'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(game.preventExpiry)}
                  onChange={e => handlePreventExpiryToggle(game.gameId, e.target.checked)}
                />
                Prevent expiry
              </label>
              <button onClick={() => handleDelete(game.gameId)} style={{ background: '#e44', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px' }}>Delete Game</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {game.players.length === 0 && <div style={{ opacity: 0.8 }}>No players in this game.</div>}
            {game.players.map(player => (
              <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <button
                  title={`Kick ${player.name}`}
                  onClick={() => handleKickPlayer(game.gameId, player.id, player.name)}
                  style={{ background: '#b22', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Kick
                </button>
                <div style={{ minWidth: 140 }}>{player.name}</div>
                <select
                  value={selectedItemByPlayerId[player.id] || ''}
                  onChange={e => setSelectedItemByPlayerId(prev => ({ ...prev, [player.id]: e.target.value }))}
                  style={{ minWidth: 330 }}
                >
                  <option value="">Select deck card</option>
                  {sortedGroupNames.map(groupName => (
                    <optgroup key={groupName} label={groupedAdminItems[groupName][0]?.groupLabel || groupName}>
                      {groupedAdminItems[groupName].map(item => (
                        <option key={`${groupName}:${item.id}`} value={item.id}>
                          {item.name} ({item.type})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  onClick={() => handleGiveItem(game.gameId, player.id)}
                  disabled={!selectedItemByPlayerId[player.id]}
                  style={{ background: '#2a7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                >
                  Give
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button onClick={handleBack} style={{ background: '#444', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8, marginRight: '20px' }}>Back</button>
        <button onClick={handleLogout} style={{ background: '#F44', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 8 }}>Logout</button>
      </div>
    </div>
  );
});

export default AdminPage;
