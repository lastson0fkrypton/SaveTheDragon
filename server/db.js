import sqlite3 from 'sqlite3';
import path from 'path';

const db = new sqlite3.Database('./database.sqlite');

// Initialize tables if not already present
function initDb() {
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
}

export { db, initDb };
