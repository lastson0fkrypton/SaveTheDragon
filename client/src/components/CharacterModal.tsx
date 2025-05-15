import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppState } from '../stores/AppState';
import type { CharacterProfile } from '../types';

const CharacterModal: React.FC<{ onClose: () => void }> = observer(({ onClose }) => {
  const state = getAppState();
  const service = state.service;

  const gameState = state.gameState;
  const playerId = state.playerId;
  if (!gameState || !playerId) return null;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  useEffect(() => {
    service.fetchCharacters().then(setCharacters);
  }, []);
  return (
    <div className="modal">
      <div className="modal-window">
        <h2>Change your Character</h2>
        <div className="inventory">
          {characters.map(char => {
            return (
              <button key={char.id} className={"card " + (char.id === player.profileId ? "equipped" : "")} onClick={() => {
                if (char.id !== player.profileId) {
                  service.updateCharacter(char.id);
                }
                onClose();
              }
              }>
                <img
                    src={`/profile-pictures/${char.id}.png`}
                    alt={char.description}
                    className="profile-pic"
                />
                <div className="card-overlay">
                    <div className="card-name"></div>
                    <div className="card-desc">{char.description}</div>
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={onClose} style={{ marginTop: 16, padding: '8px 24px' }}>Close</button>
      </div>
    </div>
  );
});

export default CharacterModal;
