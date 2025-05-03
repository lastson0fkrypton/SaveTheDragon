import express from 'express';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import path from 'path';

const app = express();
const PORT = 3000;

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    gameStateJson TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    gameId TEXT,
    name TEXT,
    playerStateJson TEXT,
    FOREIGN KEY(gameId) REFERENCES games(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS valid_moves (
    gameId TEXT,
    x INTEGER,
    y INTEGER,
    FOREIGN KEY(gameId) REFERENCES games(id)
  )`);
});

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the dist folder
app.use(express.static('dist'));

// Track last poll time for each game
const lastPoll = {};
// --- SQLite-based game state persistence ---

// Helper: serialize a game from DB rows
function serializeGame(gameRow, playerRows, validMoveRows) {
  // Parse game state JSON
  const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
  // Parse player state JSONs
  const players = playerRows.map(p => {
    const playerState = p.playerStateJson ? JSON.parse(p.playerStateJson) : {};
    return {
      id: p.id,
      name: p.name,
      ...playerState
    };
  });
  return {
    id: gameRow.id,
    ...gameState,
    players,
    validMoves: validMoveRows.map(m => ({ x: m.x, y: m.y })),
    gridSizeX: gameState.gridSizeX || 10,
    gridSizeY: gameState.gridSizeY || 10
  };
}

// Create a new game
app.post('/api/games', (req, res) => {
  const { gridSizeX, gridSizeY } = req.body;
  const safeX = Math.max(10, Math.min(100, parseInt(gridSizeX) || 10));
  const safeY = Math.max(10, Math.min(100, parseInt(gridSizeY) || 10));
  const gameId = Math.random().toString(36).substr(2, 9);
  db.run('INSERT INTO games (id, gameStateJson) VALUES (?, ?)', [gameId, JSON.stringify({ currentTurn: 0, currentDiceRoll: null, gridSizeX: safeX, gridSizeY: safeY })], err => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.status(201).json({ gameId });
  });
});

// Join an existing game
app.post('/api/games/:gameId/join', (req, res) => {
  const { gameId } = req.params;
  const { playerName } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (err) {
      console.error('DB error (games lookup):', err);
      return res.status(500).json({ error: 'DB error' });
    }
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const dir = path.join(process.cwd(), 'public', 'profile-pictures');
    fs.readdir(dir, (err, files) => {
      if (err) {
        console.error('Failed to list profile pictures:', err);
        return res.status(500).json({ error: 'Failed to list profile pictures' });
      }
      const allPics = files.filter(f => f.match(/\.(png|jpg|jpeg|gif)$/i));
      db.all('SELECT playerStateJson FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
        if (err) {
          console.error('DB error (players lookup):', err);
          return res.status(500).json({ error: 'DB error' });
        }
        // Remove already used pics
        const usedPics = playerRows.map(p => JSON.parse(p.playerStateJson).profilePic);
        const usedPositions = playerRows.map(p => {
          const ps = JSON.parse(p.playerStateJson);
          return ps && typeof ps.positionX === 'number' && typeof ps.positionY === 'number' ? `${ps.positionX},${ps.positionY}` : null;
        }).filter(Boolean);
        const availablePics = allPics.filter(pic => !usedPics.includes(pic));
        // Pick a random available pic, or fallback to 'default.png'
        const randomPic = availablePics.length > 0 ? availablePics[Math.floor(Math.random() * availablePics.length)] : 'default.png';
        db.get('SELECT * FROM players WHERE gameId = ? AND name = ?', [gameId, playerName], (err, playerRow) => {
          if (err) {
            console.error('DB error (players lookup):', err);
            return res.status(500).json({ error: 'DB error' });
          }
          if (playerRow) {
            return res.status(200).json({ playerId: playerRow.id });
          }
          const playerId = Math.random().toString(36).substr(2, 9);
          // --- Assign random position not occupied by other players ---
          const gridSizeX = gameRow.gameStateJson ? (JSON.parse(gameRow.gameStateJson).gridSizeX || 10) : 10;
          const gridSizeY = gameRow.gameStateJson ? (JSON.parse(gameRow.gameStateJson).gridSizeY || 10) : 10;
          let possiblePositions = [];
          for (let x = 0; x < gridSizeX; x++) {
            for (let y = 0; y < gridSizeY; y++) {
              if (!usedPositions.includes(`${x},${y}`)) possiblePositions.push({x, y});
            }
          }
          let positionX = 0, positionY = 0;
          if (possiblePositions.length > 0) {
            const pos = possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
            positionX = pos.x;
            positionY = pos.y;
          }
          const playerState = { positionX, positionY, hearts: 5, profilePic: randomPic };
          db.run('INSERT INTO players (id, gameId, name, playerStateJson) VALUES (?, ?, ?, ?)', [playerId, gameId, playerName, JSON.stringify(playerState)], err2 => {
            if (err2) {
              console.error('DB error (insert player):', err2);
              return res.status(500).json({ error: 'DB error' });
            }
            res.status(200).json({ playerId });
          });
        });
      });
    });
  });
});

// Fetch game state
app.get('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
      db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
        res.json(serializeGame(gameRow, playerRows, validMoveRows));
      });
    });
  });
});

// Roll dice and return the number of spaces the player can move, plus valid moves
app.post('/api/games/:gameId/roll', (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
    const gridSizeX = gameState.gridSizeX || 10;
    const gridSizeY = gameState.gridSizeY || 10;
    db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
      const player = playerRows.find(p => p.id === playerId);
      if (!player) return res.status(404).json({ error: 'Player not found' });
      if (playerRows[gameState.currentTurn].id !== playerId)
        return res.status(400).json({ error: 'Not your turn' });
      if (gameState.currentDiceRoll)
        return res.status(400).json({ error: 'Dice already rolled for this turn' });
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      // Compute valid moves
      const playerState = player.playerStateJson ? JSON.parse(player.playerStateJson) : {};
      const moves = [];
      for (let dx = -diceRoll; dx <= diceRoll; dx++) {
        for (let dy = -diceRoll; dy <= diceRoll; dy++) {
          if (Math.abs(dx) + Math.abs(dy) <= diceRoll) {
            const x = playerState.positionX + dx;
            const y = playerState.positionY + dy;
            if (
              x >= 0 && x < gridSizeX && y >= 0 && y < gridSizeY &&
              !playerRows.some(p => {
                if (p.id === player.id) return false;
                const ps = p.playerStateJson ? JSON.parse(p.playerStateJson) : {};
                return ps.positionX === x && ps.positionY === y;
              })
            ) {
              moves.push({ x, y });
            }
          }
        }
      }
      gameState.currentDiceRoll = diceRoll;
      db.serialize(() => {
        db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
        db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
        const stmt = db.prepare('INSERT INTO valid_moves (gameId, x, y) VALUES (?, ?, ?)');
        for (const m of moves) stmt.run(gameId, m.x, m.y);
        stmt.finalize(() => {
          res.json({ diceRoll, validMoves: moves });
        });
      });
    });
  });
});

// Validate and process the player's move
app.post('/api/games/:gameId/move', (req, res) => {
  const { gameId } = req.params;
  const { playerId, targetX, targetY } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    const gameState = gameRow.gameStateJson ? JSON.parse(gameRow.gameStateJson) : {};
    const gridSizeX = gameState.gridSizeX || 10;
    const gridSizeY = gameState.gridSizeY || 10;
    db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
      const player = playerRows.find(p => p.id === playerId);
      if (!player) return res.status(404).json({ error: 'Player not found' });
      if (playerRows[gameState.currentTurn].id !== playerId)
        return res.status(400).json({ error: 'Not your turn' });
      db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
        const isValid = validMoveRows.some(m => m.x === targetX && m.y === targetY);
        if (!isValid) return res.status(400).json({ error: 'Invalid move' });
        // Move player, advance turn, clear dice/valid_moves
        const nextTurn = (gameState.currentTurn + 1) % playerRows.length;
        // Update player state
        const playerState = player.playerStateJson ? JSON.parse(player.playerStateJson) : {};
        playerState.positionX = targetX;
        playerState.positionY = targetY;
        // Update game state
        gameState.currentTurn = nextTurn;
        gameState.currentDiceRoll = null;
        db.serialize(() => {
          db.run('UPDATE players SET playerStateJson = ? WHERE id = ?', [JSON.stringify(playerState), playerId]);
          db.run('UPDATE games SET gameStateJson = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
          db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
          // Return new state
          db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, newGameRow) => {
            db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, newPlayerRows) => {
              db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, newValidMoveRows) => {
                res.json({ success: true, gameState: serializeGame(newGameRow, newPlayerRows, newValidMoveRows) });
              });
            });
          });
        });
      });
    });
  });
});

// Fetch the latest game state
app.get('/api/games/:gameId/state', (req, res) => {
  const { gameId } = req.params;
  lastPoll[gameId] = Date.now();
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
      db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
        res.json(serializeGame(gameRow, playerRows, validMoveRows));
      });
    });
  });
});

// Reconnect a player to a game
app.post('/api/games/:gameId/reconnect', (req, res) => {
  const { gameId } = req.params;
  const { playerName } = req.body;
  db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, gameRow) => {
    if (!gameRow) return res.status(404).json({ error: 'Game not found' });
    db.get('SELECT * FROM players WHERE gameId = ? AND name = ?', [gameId, playerName], (err, playerRow) => {
      if (!playerRow) return res.status(404).json({ error: 'Player not found' });
      db.all('SELECT * FROM players WHERE gameId = ?', [gameId], (err, playerRows) => {
        db.all('SELECT * FROM valid_moves WHERE gameId = ?', [gameId], (err, validMoveRows) => {
          res.json({ playerId: playerRow.id, gameState: serializeGame(gameRow, playerRows, validMoveRows) });
        });
      });
    });
  });
});

// Admin endpoint to list all games (requires password)
app.get('/api/admin/games', (req, res) => {
  const password = req.query.password;
  if (password !== 'superman') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.all('SELECT * FROM games', (err, gameRows) => {
    db.all('SELECT * FROM players', (err, playerRows) => {
      const allGames = gameRows.map(gameRow => ({
        gameId: gameRow.id,
        players: playerRows.filter(p => p.gameId === gameRow.id).map(p => ({ id: p.id, name: p.name })),
        currentTurn: playerRows.filter(p => p.gameId === gameRow.id)[gameRow.currentTurn]?.name || null,
        currentDiceRoll: gameRow.currentDiceRoll || null
      }));
      res.json(allGames);
    });
  });
});

// Admin endpoint to delete a game (requires password)
app.delete('/api/admin/games/:gameId', (req, res) => {
  const password = req.query.password;
  if (password !== 'superman') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { gameId } = req.params;
  db.run('DELETE FROM games WHERE id = ?', [gameId], err => {
    db.run('DELETE FROM players WHERE gameId = ?', [gameId]);
    db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
    res.json({ success: true });
  });
});

// Endpoint to list available profile pictures
app.get('/api/profile-pictures', (req, res) => {
  const dir = path.join(process.cwd(), 'public', 'profile-pictures');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to list profile pictures' });
    res.json(files.filter(f => f.match(/\.(png|jpg|jpeg|gif)$/i)));
  });
});

// Endpoint to update a player's profile picture
app.post('/api/games/:gameId/player/:playerId/profile-pic', (req, res) => {
  const { gameId, playerId } = req.params;
  const { profilePic } = req.body;
  db.get('SELECT * FROM players WHERE id = ? AND gameId = ?', [playerId, gameId], (err, playerRow) => {
    if (!playerRow) return res.status(404).json({ error: 'Player not found' });
    const playerState = playerRow.playerStateJson ? JSON.parse(playerRow.playerStateJson) : {};
    playerState.profilePic = profilePic;
    db.run('UPDATE players SET playerStateJson = ? WHERE id = ? AND gameId = ?', [JSON.stringify(playerState), playerId, gameId], err2 => {
      if (err2) return res.status(500).json({ error: 'Failed to update profile picture' });
      res.json({ success: true });
    });
  });
});

// Periodically clean up inactive games (no poll in 60s)
setInterval(() => {
  const now = Date.now();
  db.all('SELECT id FROM games', (err, rows) => {
    if (rows) {
      for (const row of rows) {
        const gameId = row.id;
        if (!lastPoll[gameId] || now - lastPoll[gameId] > 60000) {
          db.run('DELETE FROM games WHERE id = ?', [gameId]);
          db.run('DELETE FROM players WHERE gameId = ?', [gameId]);
          db.run('DELETE FROM valid_moves WHERE gameId = ?', [gameId]);
          delete lastPoll[gameId];
          console.log(`Game ${gameId} deleted due to inactivity.`);
        }
      }
    }
  });
}, 60000);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});