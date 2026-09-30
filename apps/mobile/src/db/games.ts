import type { DeliveryInput } from '@bowling-rpg/scoring';
import type { SQLiteDatabase } from 'expo-sqlite';
import { uuidv7 } from '@/lib/uuid';

/** The subset of expo-sqlite this module uses, so tests can supply an in-memory SQLite. */
export type Db = Pick<SQLiteDatabase, 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'withExclusiveTransactionAsync'>;

export interface StoredGame {
  readonly gameId: string;
  readonly sessionId: string;
  readonly gameNumber: number;
  readonly deliveries: readonly DeliveryInput[];
}

export interface RecentGame extends StoredGame {
  readonly startedAt: string;
  readonly sessionOpen: boolean;
}

interface DeliveryRow {
  game_id: string;
  knocked: number;
  foul: number;
}

export async function startSession(db: Db, now: Date = new Date()): Promise<{ sessionId: string; gameId: string }> {
  const sessionId = uuidv7(now.getTime());
  const gameId = uuidv7(now.getTime());
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('INSERT INTO sessions (id, started_at) VALUES (?, ?)', sessionId, now.toISOString());
    await txn.runAsync('INSERT INTO games (id, session_id, game_number) VALUES (?, ?, 1)', gameId, sessionId);
  });
  return { sessionId, gameId };
}

export async function startNextGame(db: Db, sessionId: string): Promise<string> {
  const gameId = uuidv7();
  await db.runAsync(
    `INSERT INTO games (id, session_id, game_number)
     VALUES (?, ?, (SELECT COALESCE(MAX(game_number), 0) + 1 FROM games WHERE session_id = ?))`,
    gameId,
    sessionId,
    sessionId,
  );
  return gameId;
}

/** The session's latest game with its deliveries in order, or null if the session doesn't exist. */
export async function fetchCurrentGame(db: Db, sessionId: string): Promise<StoredGame | null> {
  const game = await db.getFirstAsync<{ id: string; game_number: number }>(
    'SELECT id, game_number FROM games WHERE session_id = ? ORDER BY game_number DESC LIMIT 1',
    sessionId,
  );
  if (!game) return null;
  const rows = await db.getAllAsync<DeliveryRow>('SELECT game_id, knocked, foul FROM deliveries WHERE game_id = ? ORDER BY seq', game.id);
  return { gameId: game.id, sessionId, gameNumber: game.game_number, deliveries: rows.map(toDelivery) };
}

/** Written the moment the ball is recorded, so a crash or a dead battery loses nothing. */
export async function appendDelivery(db: Db, gameId: string, delivery: DeliveryInput, thrownAt: Date = new Date()): Promise<void> {
  await db.runAsync(
    `INSERT INTO deliveries (game_id, seq, knocked, foul, thrown_at)
     VALUES (?, (SELECT COALESCE(MAX(seq) + 1, 0) FROM deliveries WHERE game_id = ?), ?, ?, ?)`,
    gameId,
    gameId,
    delivery.knocked,
    delivery.foul ? 1 : 0,
    thrownAt.toISOString(),
  );
}

export async function removeLastDelivery(db: Db, gameId: string): Promise<void> {
  await db.runAsync('DELETE FROM deliveries WHERE game_id = ? AND seq = (SELECT MAX(seq) FROM deliveries WHERE game_id = ?)', gameId, gameId);
}

/**
 * Closes the session. Games with no balls are dropped (the server requires at
 * least one), and a session left with no games is dropped entirely.
 */
export async function endSession(db: Db, sessionId: string, now: Date = new Date()): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'DELETE FROM games WHERE session_id = ? AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.game_id = games.id)',
      sessionId,
    );
    await txn.runAsync('UPDATE sessions SET ended_at = ? WHERE id = ?', now.toISOString(), sessionId);
    await txn.runAsync('DELETE FROM sessions WHERE id = ? AND NOT EXISTS (SELECT 1 FROM games WHERE session_id = ?)', sessionId, sessionId);
  });
}

interface GameRow {
  id: string;
  session_id: string;
  game_number: number;
  started_at: string;
  ended_at: string | null;
}

const GAME_COLUMNS = 'SELECT g.id, g.session_id, g.game_number, s.started_at, s.ended_at FROM games g JOIN sessions s ON s.id = g.session_id';

export async function fetchRecentGames(db: Db, limit = 30): Promise<RecentGame[]> {
  const games = await db.getAllAsync<GameRow>(`${GAME_COLUMNS} ORDER BY s.started_at DESC, g.game_number DESC LIMIT ?`, limit);
  return withDeliveries(db, games);
}

/** Every game, oldest first: the order the bestiary needs to know what was seen first. */
export async function fetchAllGames(db: Db): Promise<RecentGame[]> {
  const games = await db.getAllAsync<GameRow>(`${GAME_COLUMNS} ORDER BY s.started_at, g.game_number`);
  return withDeliveries(db, games, 'all');
}

/**
 * Attaches each game's deliveries. With 'all', every delivery is read in one
 * plain query, since an IN list over every game would eventually exceed
 * SQLite's parameter limit.
 */
async function withDeliveries(db: Db, games: readonly GameRow[], scope: 'listed' | 'all' = 'listed'): Promise<RecentGame[]> {
  if (games.length === 0) return [];

  const rows =
    scope === 'all'
      ? await db.getAllAsync<DeliveryRow>('SELECT game_id, knocked, foul FROM deliveries ORDER BY game_id, seq')
      : await db.getAllAsync<DeliveryRow>(
          `SELECT game_id, knocked, foul FROM deliveries WHERE game_id IN (${games.map(() => '?').join(', ')}) ORDER BY game_id, seq`,
          ...games.map((g) => g.id),
        );
  const byGame = new Map<string, DeliveryInput[]>();
  for (const row of rows) {
    const list = byGame.get(row.game_id);
    if (list) list.push(toDelivery(row));
    else byGame.set(row.game_id, [toDelivery(row)]);
  }

  return games.map((g) => ({
    gameId: g.id,
    sessionId: g.session_id,
    gameNumber: g.game_number,
    startedAt: g.started_at,
    sessionOpen: g.ended_at === null,
    deliveries: byGame.get(g.id) ?? [],
  }));
}

const toDelivery = (row: DeliveryRow): DeliveryInput => ({ knocked: row.knocked, foul: row.foul === 1 });
