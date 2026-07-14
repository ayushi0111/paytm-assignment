import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type DB = Database.Database;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    api_key       TEXT NOT NULL UNIQUE,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- code is nullable only transiently: generated (non-custom) codes are
  -- derived from the row's own id, so the row is inserted with code = NULL
  -- and updated once the id is known. SQLite treats each NULL in a UNIQUE
  -- index as distinct, so this never collides with a real code.
  CREATE TABLE IF NOT EXISTS urls (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    code             TEXT UNIQUE,
    original_url     TEXT NOT NULL,
    normalized_url   TEXT NOT NULL,
    is_custom        INTEGER NOT NULL DEFAULT 0,
    owner_id         INTEGER NOT NULL REFERENCES users(id),
    click_count      INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_urls_owner_normalized ON urls(owner_id, normalized_url);
  CREATE INDEX IF NOT EXISTS idx_urls_owner ON urls(owner_id);
`;

export function createDatabase(filename: string): DB {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function getDefaultDbPath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'urls.sqlite');
}
