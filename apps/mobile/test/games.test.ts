import { FULL_RACK, maskFromPins, scoreGame } from '@bowling-rpg/scoring';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  appendDelivery,
  endSession,
  fetchCurrentGame,
  fetchRecentGames,
  removeLastDelivery,
  startNextGame,
  startSession,
} from '@/db/games';
import { SCHEMA_VERSION, migrate } from '@/db/migrations';
import { createMemoryDb } from './memory-db';

let db: SQLiteDatabase;
beforeEach(async () => {
  db = await createMemoryDb();
});

describe('migrations', () => {
  it('bring a new database to the latest version, and are safe to run again', async () => {
    await migrate(db);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: SCHEMA_VERSION });
  });

  it('refuse a mask a phone could never produce', async () => {
    const { gameId } = await startSession(db);
    await expect(appendDelivery(db, gameId, { knocked: 1024 })).rejects.toThrow(/CHECK constraint/);
  });
});

describe('a session', () => {
  it('starts with game 1 and no balls', async () => {
    const { sessionId, gameId } = await startSession(db);
    expect(await fetchCurrentGame(db, sessionId)).toEqual({ gameId, sessionId, gameNumber: 1, deliveries: [] });
  });

  it('stores balls in order, fouls included, and undoes the last one', async () => {
    const { sessionId, gameId } = await startSession(db);
    await appendDelivery(db, gameId, { knocked: maskFromPins([1, 2, 3]), foul: true });
    await appendDelivery(db, gameId, { knocked: FULL_RACK });
    await appendDelivery(db, gameId, { knocked: 0 });
    await removeLastDelivery(db, gameId);

    const game = await fetchCurrentGame(db, sessionId);
    expect(game?.deliveries).toEqual([
      { knocked: maskFromPins([1, 2, 3]), foul: true },
      { knocked: FULL_RACK, foul: false },
    ]);
    // The foul respots, so clearing the full rack on ball 2 is a spare.
    expect(scoreGame(game!.deliveries)).toMatchObject({ ok: true, game: { frames: [{ isSpare: true }] } });
  });

  it('moves on to the next game', async () => {
    const { sessionId } = await startSession(db);
    const second = await startNextGame(db, sessionId);
    expect(await fetchCurrentGame(db, sessionId)).toMatchObject({ gameId: second, gameNumber: 2 });
  });

  it('drops empty games when it ends, and itself if nothing was bowled', async () => {
    const played = await startSession(db);
    await appendDelivery(db, played.gameId, { knocked: FULL_RACK });
    await startNextGame(db, played.sessionId);
    await endSession(db, played.sessionId);

    const empty = await startSession(db);
    await endSession(db, empty.sessionId);

    expect(await fetchCurrentGame(db, played.sessionId)).toMatchObject({ gameNumber: 1 });
    expect(await fetchCurrentGame(db, empty.sessionId)).toBeNull();
  });

  it('is null when it does not exist', async () => {
    expect(await fetchCurrentGame(db, 'nope')).toBeNull();
  });
});

describe('recent games', () => {
  it('lists newest sessions first with their balls, and knows which sessions are open', async () => {
    const older = await startSession(db, new Date('2026-09-20T19:00:00Z'));
    await appendDelivery(db, older.gameId, { knocked: FULL_RACK });
    await endSession(db, older.sessionId);

    const newer = await startSession(db, new Date('2026-09-27T19:00:00Z'));
    await startNextGame(db, newer.sessionId);

    const games = await fetchRecentGames(db);
    expect(games.map((g) => [g.sessionId, g.gameNumber, g.sessionOpen, g.deliveries.length])).toEqual([
      [newer.sessionId, 2, true, 0],
      [newer.sessionId, 1, true, 0],
      [older.sessionId, 1, false, 1],
    ]);
  });

  it('is empty on a fresh install', async () => {
    expect(await fetchRecentGames(db)).toEqual([]);
  });
});
