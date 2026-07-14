import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type DB = Database.Database;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS urls (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    code             TEXT NOT NULL UNIQUE,
    original_url     TEXT NOT NULL,
    normalized_url   TEXT NOT NULL,
    is_custom        INTEGER NOT NULL DEFAULT 0,
    click_count      INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_urls_normalized_url ON urls(normalized_url);
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
