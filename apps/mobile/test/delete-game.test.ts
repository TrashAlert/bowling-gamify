import { FULL_RACK, type DeliveryInput, maskFromPins, without } from '@bowling-rpg/scoring';
import type { SQLiteDatabase } from 'expo-sqlite';
import { appendDelivery, deleteGame, endSession, fetchRecentGames, startNextGame, startSession } from '@/db/games';
import { deleteGameConfirmation } from '@/features/history/delete-game';
import { gameStats, levelsReached, loadGameReport, loadHistory, progressPoints } from '@/features/history/load';
import { createMemoryDb } from './memory-db';

const leave = (...p: number[]): DeliveryInput => ({ knocked: without(FULL_RACK, maskFromPins(p)) });
const hit = (...p: number[]): DeliveryInput => ({ knocked: maskFromPins(p) });
const PERFECT: DeliveryInput[] = Array.from({ length: 12 }, () => ({ knocked: FULL_RACK }));
/** Ten 9-spares with a 9 fill: 190. */
const NINE_SPARES: DeliveryInput[] = [...Array.from({ length: 10 }, () => [leave(10), hit(10)]).flat(), hit(1, 2, 3, 4, 5, 6, 7, 8, 9)];

let db: SQLiteDatabase;
beforeEach(async () => {
  db = await createMemoryDb();
});

/** One session, one game per entry, each game's balls in order. Returns the game IDs. */
async function bowl(startedAt: string, ...games: DeliveryInput[][]) {
  const { sessionId, gameId } = await startSession(db, new Date(startedAt));
  const ids = [gameId];
  for (const [i, balls] of games.entries()) {
    if (i > 0) ids.push(await startNextGame(db, sessionId));
    for (const ball of balls) await appendDelivery(db, ids[i]!, ball);
  }
  await endSession(db, sessionId);
  return { sessionId, ids };
}

const count = async (table: string) => (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

describe('deleting a game', () => {
  it('removes the game and every ball in it', async () => {
    const { ids } = await bowl('2026-09-28T19:00:00Z', PERFECT, NINE_SPARES);
    await deleteGame(db, ids[0]!);

    expect(await count('games')).toBe(1);
    expect(await count('deliveries')).toBe(NINE_SPARES.length);
  });

  it('moves later games in the session up a number, keeping their order', async () => {
    const { ids } = await bowl('2026-09-28T19:00:00Z', PERFECT, NINE_SPARES, PERFECT);
    await deleteGame(db, ids[0]!);

    const remaining = await db.getAllAsync<{ id: string; game_number: number }>('SELECT id, game_number FROM games ORDER BY game_number');
    expect(remaining).toEqual([
      { id: ids[1], game_number: 1 },
      { id: ids[2], game_number: 2 },
    ]);
  });

  it('removes the session when its last game goes, and leaves other sessions alone', async () => {
    const lone = await bowl('2026-09-20T19:00:00Z', PERFECT);
    const other = await bowl('2026-09-28T19:00:00Z', NINE_SPARES);
    await deleteGame(db, lone.ids[0]!);

    expect(await db.getAllAsync('SELECT id FROM sessions')).toEqual([{ id: other.sessionId }]);
    expect((await fetchRecentGames(db)).map((g) => g.gameId)).toEqual(other.ids);
  });

  it('does nothing for a game that no longer exists', async () => {
    await bowl('2026-09-28T19:00:00Z', PERFECT);
    await deleteGame(db, 'missing');
    expect(await count('games')).toBe(1);
  });
});

describe('after deleting a game, XP and stats no longer include it', () => {
  it('takes its XP away, and the level with it', async () => {
    // 300 + 300 = 600 XP: level 2 (reached at 500), then 190 more.
    const { ids } = await bowl('2026-09-28T19:00:00Z', PERFECT, PERFECT, NINE_SPARES);
    const before = await loadHistory(db);
    expect(before.progression.current).toMatchObject({ totalXp: 790, level: 2 });
    expect([...levelsReached(before)]).toEqual([[ids[1], 2]]);

    await deleteGame(db, ids[1]!);

    const after = await loadHistory(db);
    expect(after.progression.current).toMatchObject({ totalXp: 490, level: 1 });
    // No game reaches level 2 any more, so no game carries the marker.
    expect(levelsReached(after).size).toBe(0);
  });

  it('removes it from games, average, best and the charts', async () => {
    const { ids } = await bowl('2026-09-28T19:00:00Z', NINE_SPARES, PERFECT, NINE_SPARES);
    expect(gameStats(await loadHistory(db))).toEqual({ games: 3, average: 227, best: 300 });

    await deleteGame(db, ids[1]!); // the 300

    const after = await loadHistory(db);
    expect(gameStats(after)).toEqual({ games: 2, average: 190, best: 190 });
    expect(progressPoints(after).map((p) => p.metrics.score)).toEqual([190, 190]);
  });

  it('recalculates the XP shown for the games after it', async () => {
    const { ids } = await bowl('2026-09-28T19:00:00Z', PERFECT, NINE_SPARES);
    expect((await loadGameReport(db, ids[1]!))?.xp.before.totalXp).toBe(300);

    await deleteGame(db, ids[0]!);
    expect((await loadGameReport(db, ids[1]!))?.xp.before.totalXp).toBe(0);
    expect(await loadGameReport(db, ids[0]!)).toBeNull();
  });
});

describe('the delete confirmation', () => {
  it('names the game and the exact XP it takes away', async () => {
    const { ids } = await bowl('2026-09-28T12:00:00Z', NINE_SPARES);
    const { game, xp } = (await loadGameReport(db, ids[0]!))!;
    const { title, message } = deleteGameConfirmation(game, xp);

    expect(title).toBe('Delete this game?');
    expect(message).toMatch(/^Game 1 · .+ · 190\n\nIts 190 XP and its stats will be removed, so your level may go down\. This can’t be undone\.$/);
  });

  it('says an unfinished game earned no XP', async () => {
    const { ids } = await bowl('2026-09-28T12:00:00Z', [leave(10), hit(10)]);
    const { game, xp } = (await loadGameReport(db, ids[0]!))!;
    expect(deleteGameConfirmation(game, xp).message).toContain('It earned no XP, but its stats will be removed.');
  });
});
