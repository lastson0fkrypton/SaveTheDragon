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

function getDeckDifficultyOrder(deckId: string): number {
  if (deckId.startsWith('easy_')) return 0;
  if (deckId.startsWith('medium_')) return 1;
  if (deckId.startsWith('hard_')) return 2;
  return 3;
}

function getDeckKindOrder(deckId: string): number {
  if (deckId.endsWith('_encounter')) return 0;
  if (deckId.endsWith('_loot')) return 1;
  return 2;
}

function compareDeckIds(leftDeckId: string, rightDeckId: string): number {
  const difficultyDelta = getDeckDifficultyOrder(leftDeckId) - getDeckDifficultyOrder(rightDeckId);
  if (difficultyDelta !== 0) return difficultyDelta;

  const kindDelta = getDeckKindOrder(leftDeckId) - getDeckKindOrder(rightDeckId);
  if (kindDelta !== 0) return kindDelta;

  return leftDeckId.localeCompare(rightDeckId);
}

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

  const renderCardStats = (card: {
    id: string;
    health?: number | null;
    attack?: number | null;
    attackChance?: number | null;
    defense?: number | null;
    defenseChance?: number | null;
    heal?: number | null;
    effect?: string | null;
    hearts?: number | null;
  }) => (
    <div style={{ opacity: 0.9, fontSize: 12 }}>
      id={card.id}
      {card.health != null ? ` | hp=${card.health}` : ''}
      {card.attack != null ? ` | atk=${card.attack}` : ''}
      {card.attackChance != null ? ` | atk%=${card.attackChance}` : ''}
      {card.defense != null ? ` | def=${card.defense}` : ''}
      {card.defenseChance != null ? ` | def%=${card.defenseChance}` : ''}
      {card.heal != null ? ` | heal=${card.heal}` : ''}
      {card.effect ? ` | effect=${card.effect}` : ''}
      {card.hearts != null ? ` | hearts=${card.hearts}` : ''}
    </div>
  );

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
    <div style={{ maxWidth: 1040, height: 'calc(100vh - 32px)', margin: '16px auto', background: '#23234a', color: '#fff', borderRadius: 16, padding: 32, position: 'relative', overflowY: 'auto', boxSizing: 'border-box' }}>
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
              <div key={player.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                            {item.name}{item.variant ? ` [${item.variant}]` : ''} ({item.type})
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

                {player.cards && (
                  <details style={{ marginTop: 6, marginLeft: 26 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13, opacity: 0.95 }}>
                      Cards - weapons {player.cards.weapons.length}, armor {player.cards.armor.length}, items {player.cards.items.length}
                    </summary>
                    <div style={{ marginTop: 6, background: '#1c1c2b', borderRadius: 8, padding: 8 }}>
                      {([
                        ['Weapons', player.cards.weapons],
                        ['Armor', player.cards.armor],
                        ['Items', player.cards.items],
                      ] as const).map(([label, cards]) => (
                        <div key={`${player.id}:${label}`} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                          {cards.length === 0 ? (
                            <div style={{ opacity: 0.75, fontSize: 12 }}>None</div>
                          ) : (
                            cards.map((card, index) => (
                              <div key={`${player.id}:${label}:${card.id}:${index}`} style={{ padding: '4px 2px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <div>
                                  <strong>{index + 1}.</strong> {card.name}
                                  {card.type ? ` (${card.type})` : ''}
                                  {card.equipped ? ' [equipped]' : ''}
                                </div>
                                {renderCardStats(card)}
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, background: '#1d1d2f', borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Deck Cards (cards + expanded consumables)</div>
            {!game.deckSnapshots || Object.keys(game.deckSnapshots).length === 0 ? (
              <div style={{ opacity: 0.85 }}>No deck snapshot available.</div>
            ) : (
              Object.values(game.deckSnapshots)
                .sort((a, b) => compareDeckIds(a.deckId, b.deckId))
                .map(deck => (
                  <details key={deck.deckId} style={{ marginBottom: 8 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      {deck.deckId} - total {deck.totalCount} (cards {deck.explicitCount} + consumables {deck.consumableCount})
                    </summary>
                    <div style={{ marginTop: 8, maxHeight: 280, overflowY: 'auto', background: '#181825', borderRadius: 8, padding: 8 }}>
                      {[...deck.cards].reverse().map((card, index) => (
                        <div key={`${deck.deckId}:${index}:${card.id}:${card.source}:${card.repeat}`} style={{ padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <div>
                            <strong>{index + 1}.</strong> {card.name} [{card.kind}] ({card.source})
                            {card.variant ? ` variant=${card.variant}` : ''}
                            {card.type ? ` type=${card.type}` : ''}
                          </div>
                          {renderCardStats(card)}
                        </div>
                      ))}
                    </div>
                  </details>
                ))
            )}
          </div>

          <div style={{ marginTop: 14, background: '#1d1d2f', borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Discard Piles</div>
            {!game.discardSnapshots || Object.keys(game.discardSnapshots).length === 0 ? (
              <div style={{ opacity: 0.85 }}>No discard snapshot available.</div>
            ) : (
              Object.values(game.discardSnapshots)
                .sort((a, b) => compareDeckIds(a.deckId, b.deckId))
                .map(snapshot => (
                  <details key={`${game.gameId}:discard:${snapshot.deckId}`} style={{ marginBottom: 8 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      {snapshot.deckId} - encounter {snapshot.encounterDiscardCount}, loot {snapshot.lootDiscardCount}
                    </summary>
                    <div style={{ marginTop: 8, maxHeight: 280, overflowY: 'auto', background: '#181825', borderRadius: 8, padding: 8 }}>
                      {([
                        ['Encounter discard', snapshot.encounterDiscard],
                        ['Loot discard', snapshot.lootDiscard],
                      ] as const).map(([label, cards]) => (
                        <div key={`${snapshot.deckId}:${label}`} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                          {cards.length === 0 ? (
                            <div style={{ opacity: 0.75, fontSize: 12 }}>Empty</div>
                          ) : (
                            cards.map((card, index) => (
                              <div key={`${snapshot.deckId}:${label}:${card.id}:${index}`} style={{ padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <div>
                                  <strong>{index + 1}.</strong> {card.name} [{card.kind}] ({card.source})
                                  {card.variant ? ` variant=${card.variant}` : ''}
                                  {card.type ? ` type=${card.type}` : ''}
                                </div>
                                {renderCardStats(card)}
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                ))
            )}
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
