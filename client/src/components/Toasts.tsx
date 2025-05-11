import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';

const Toasts: React.FC = observer(() => {
  const state = getAppState();
  const gameState = state.gameState;
  // Track dismissed and seen notifications in state
  const [toasts, setToasts] = React.useState<any[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  // On gameState.recentActions change, add new toasts
  useEffect(() => {
    if (!gameState?.recentActions) return;
    const newToasts = gameState.recentActions.filter(a => !seenIds.current.has(a.id));
    if (newToasts.length > 0) {
      setToasts(prev => [
        ...newToasts.map(t => ({ ...t, visible: true })),
        ...prev.filter(t => t.visible)
      ].slice(0, 3));
      newToasts.forEach(a => seenIds.current.add(a.id));
    }
  }, [gameState?.recentActions]);

  // Auto-hide after 4 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast, i) =>
      setTimeout(() => {
        setToasts(prev => prev.map((t, idx) => idx === i ? { ...t, visible: false } : t));
      }, 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const dismiss = (id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
  };

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
      {toasts.filter(t => t.visible).map(action => (
        <div key={action.id} style={{ background: '#333', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, minWidth: 200, boxShadow: '0 2px 8px #0008', position: 'relative' }}>
          <b>{action.playerName}</b> {action.type === 'equip' && 'equipped'}{action.type === 'use-item' && 'used'}{action.type === 'battle-end' && ''} <b>{action.itemName}</b>
          <button onClick={() => dismiss(action.id)} style={{ position: 'absolute', top: 4, right: 8, background: 'none', color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer' }}>&times;</button>
        </div>
      ))}
    </div>
  );
});

export default Toasts;
