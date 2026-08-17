const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'healthos.db'));

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      organisation TEXT,
      role TEXT,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { db, initDb };
