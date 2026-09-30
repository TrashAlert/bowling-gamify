import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Append-only. Entry N moves the database from version N to N+1; never edit an
 * entry that has shipped. Only raw deliveries are stored: scores, strikes and
 * splits are recomputed by @bowling-rpg/scoring every time a game is loaded.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,           -- UUIDv7; becomes the sync clientId
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    synced_at   TEXT                        -- set once the server confirms it
  );
  CREATE TABLE games (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    game_number INTEGER NOT NULL CHECK (game_number >= 1),
    UNIQUE (session_id, game_number)
  );
  CREATE TABLE deliveries (
    game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL CHECK (seq BETWEEN 0 AND 20),
    knocked     INTEGER NOT NULL CHECK (knocked BETWEEN 0 AND 1023),
    foul        INTEGER NOT NULL DEFAULT 0 CHECK (foul IN (0, 1)),
    thrown_at   TEXT NOT NULL,
    PRIMARY KEY (game_id, seq)
  );
  CREATE INDEX sessions_started_idx ON sessions (started_at DESC);
  `,
  `
  CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL               -- JSON
  );
  `,
  `
  CREATE TABLE profile (
    id             INTEGER PRIMARY KEY CHECK (id = 1),   -- one row: this phone's bowler
    display_name   TEXT CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 30),
    hand           TEXT CHECK (hand IN ('right', 'left')),
    ball_name      TEXT CHECK (ball_name IS NULL OR length(ball_name) BETWEEN 1 AND 40),
    ball_brand     TEXT CHECK (ball_brand IS NULL OR length(ball_brand) BETWEEN 1 AND 40),
    ball_weight_lb INTEGER CHECK (ball_weight_lb BETWEEN 6 AND 16)
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Runs as SQLiteProvider's onInit, before any screen can query. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version]!;
    const target = version + 1;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(sql);
      await txn.execAsync(`PRAGMA user_version = ${target}`);
    });
  }
}
