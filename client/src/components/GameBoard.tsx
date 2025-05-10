import React from 'react';
import type { GameState } from '../types';

interface GameBoardProps {
  gameState: GameState;
  onCellClick?: (x: number, y: number) => void;
}

const biomeImages: Record<string, string> = {
  castle: '/biomes/castle.png',
  cave: '/biomes/cave.png',
  desert: '/biomes/desert.png',
  forest: '/biomes/forest.png',
  plains: '/biomes/plains.png',
  town: '/biomes/town.png',
  volcano: '/biomes/volcano.png',
};

const GameBoard: React.FC<GameBoardProps> = ({ gameState, onCellClick }) => {
  if (!gameState.biomeGrid) return null;
  return (
    <div style={{ display: 'inline-block', border: '2px solid #333', background: '#222' }}>
      {gameState.biomeGrid.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {row.map((biome, x) => {
            const player = gameState.players.find(p => p.positionX === x && p.positionY === y);
            const isValid = gameState.validMoves?.some(m => m.x === x && m.y === y);
            return (
              <div
                key={x}
                style={{
                  width: 40,
                  height: 40,
                  border: '1px solid #444',
                  background: `url(${biomeImages[biome]}) center/cover`,
                  position: 'relative',
                  cursor: isValid ? 'pointer' : 'default',
                  opacity: isValid ? 0.8 : 1,
                }}
                onClick={() => isValid && onCellClick && onCellClick(x, y)}
              >
                {player && (
                  <img
                    src={player.profilePic ? `/profile-pictures/${player.profilePic}` : '/vite.svg'}
                    alt={player.name}
                    style={{ width: 32, height: 32, position: 'absolute', left: 4, top: 4, borderRadius: 8, border: '2px solid #fff' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default GameBoard;
