import type { Db } from './games';

/**
 * A complete copy of the bowler's data, in the same shape the sync upload uses
 * (sessions → games → raw deliveries), so a later import or upload can read it.
 */
export interface ExportFile {
  readonly format: 'bowling-rpg.export';
  readonly version: 1;
  readonly exportedAt: string;
  readonly sessions: readonly ExportedSession[];
}

export interface ExportedSession {
  readonly clientId: string;
  readonly startedAt: string;
  /** Null while the session is still open. */
  readonly endedAt: string | null;
  readonly games: readonly {
    readonly gameNumber: number;
    readonly deliveries: readonly { readonly knocked: number; readonly foul: boolean; readonly thrownAt: string }[];
  }[];
}

interface Row {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  game_number: number | null;
  knocked: number | null;
  foul: number | null;
  thrown_at: string | null;
}

/** Everything on the phone, oldest session first. One query, grouped in memory. */
export async function fetchExport(db: Db, now: Date = new Date()): Promise<ExportFile> {
  const rows = await db.getAllAsync<Row>(
    `SELECT s.id AS session_id, s.started_at, s.ended_at, g.game_number, d.knocked, d.foul, d.thrown_at
     FROM sessions s
     LEFT JOIN games g ON g.session_id = s.id
     LEFT JOIN deliveries d ON d.game_id = g.id
     ORDER BY s.started_at, s.id, g.game_number, d.seq`,
  );

  const sessions: {
    clientId: string;
    startedAt: string;
    endedAt: string | null;
    games: { gameNumber: number; deliveries: { knocked: number; foul: boolean; thrownAt: string }[] }[];
  }[] = [];
  for (const row of rows) {
    let session = sessions.at(-1);
    if (session?.clientId !== row.session_id) {
      session = { clientId: row.session_id, startedAt: row.started_at, endedAt: row.ended_at, games: [] };
      sessions.push(session);
    }
    if (row.game_number === null) continue; // a session with no games yet
    let game = session.games.at(-1);
    if (game?.gameNumber !== row.game_number) {
      game = { gameNumber: row.game_number, deliveries: [] };
      session.games.push(game);
    }
    if (row.knocked !== null && row.thrown_at !== null) {
      game.deliveries.push({ knocked: row.knocked, foul: row.foul === 1, thrownAt: row.thrown_at });
    }
  }

  return { format: 'bowling-rpg.export', version: 1, exportedAt: now.toISOString(), sessions };
}

/** Games stored on the phone, finished or not. */
export async function countGames(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM games');
  return row?.count ?? 0;
}

/** Deletes every session, game and ball on the phone. Settings are kept. */
export async function deleteAllGames(db: Db): Promise<void> {
  // Games and deliveries go with their session (ON DELETE CASCADE).
  await db.runAsync('DELETE FROM sessions');
}
