import { randomUUID } from 'node:crypto';
import { FULL_RACK, type DeliveryInput, maskFromPins } from '@bowling-rpg/scoring';
import { and, eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { XpSource } from '../src/enums';
import * as t from '../src/schema';
import { type Db, createSession, createTestDb, createUser, insertScoredGame, violation } from './helpers';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

const gutter: DeliveryInput = { knocked: 0 };
const NINE_GUTTER_FRAMES: DeliveryInput[] = Array.from({ length: 18 }, () => gutter);
const PERFECT: DeliveryInput[] = Array.from({ length: 12 }, () => ({ knocked: FULL_RACK }));

/** A throw row with sensible defaults, for constraint tests. */
async function throwRow(overrides: Partial<typeof t.throws.$inferInsert> = {}) {
  const userId = await createUser(db);
  const gameId = await insertScoredGame(db, userId, await createSession(db, userId), [gutter]);
  const [frame] = await db.select({ id: t.frames.id }).from(t.frames).where(eq(t.frames.gameId, gameId));
  return {
    frameId: frame!.id,
    userId,
    throwNumber: 2,
    pinsStandingBefore: FULL_RACK,
    pinsKnocked: 0,
    newRack: false,
    thrownAt: new Date(),
    ...overrides,
  } satisfies typeof t.throws.$inferInsert;
}

describe('migrations', () => {
  it('enable row-level security on every table', async () => {
    const rows = await db.execute<{ relname: string }>(sql`
      SELECT relname FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity`);
    expect(rows.rows).toEqual([]);
  });
});

describe('storing scored games', () => {
  it('round-trips a perfect game', async () => {
    const userId = await createUser(db);
    const gameId = await insertScoredGame(db, userId, await createSession(db, userId), PERFECT);
    const [game] = await db.select().from(t.games).where(eq(t.games.id, gameId));
    expect(game).toMatchObject({ totalScore: 300, isComplete: true });
    const throwCount = await db.$count(t.throws, eq(t.throws.userId, userId));
    expect(throwCount).toBe(12);
  });

  it('computes each throw’s leave, so it can never disagree with the pins', async () => {
    const userId = await createUser(db);
    await insertScoredGame(db, userId, await createSession(db, userId), [{ knocked: maskFromPins([1, 2, 3, 4, 5, 6, 8, 9]) }]);
    const [row] = await db.select({ leaveMask: t.throws.leaveMask }).from(t.throws).where(eq(t.throws.userId, userId));
    expect(row!.leaveMask).toBe(maskFromPins([7, 10]));
  });

  it('stores no frame leave after a first-ball foul', async () => {
    const userId = await createUser(db);
    await insertScoredGame(db, userId, await createSession(db, userId), [{ knocked: maskFromPins([1, 2, 3]), foul: true }]);
    const [frame] = await db.select().from(t.frames).where(eq(t.frames.userId, userId));
    expect(frame!.leaveMask).toBeNull();
  });

  it('finds a tenth-frame reset-rack split that the frames table cannot hold', async () => {
    const userId = await createUser(db);
    const tenth: DeliveryInput[] = [{ knocked: FULL_RACK }, { knocked: maskFromPins([1, 2, 3, 4, 5, 6, 8, 9]) }, { knocked: maskFromPins([7]) }];
    await insertScoredGame(db, userId, await createSession(db, userId), [...NINE_GUTTER_FRAMES, ...tenth]);

    const [tenthFrame] = await db
      .select()
      .from(t.frames)
      .where(and(eq(t.frames.userId, userId), eq(t.frames.frameNumber, 10)));
    expect(tenthFrame).toMatchObject({ leaveMask: 0, isStrike: true, isSplit: false });

    // The bestiary query, shaped to use throws_bestiary_idx.
    const splits = await db
      .select({ leaveMask: t.throws.leaveMask })
      .from(t.throws)
      .where(and(eq(t.throws.userId, userId), sql`new_rack AND NOT is_foul AND leave_mask <> 0`, eq(t.throws.isSplit, true)));
    expect(splits).toEqual([{ leaveMask: maskFromPins([7, 10]) }]);
  });
});

describe('throw constraints', () => {
  it.each([
    ['a pin that was already down', { pinsStandingBefore: maskFromPins([7, 10]), pinsKnocked: maskFromPins([7, 8]) }, 'throws_knocked_were_standing'],
    ['a new rack that is not full', { newRack: true, pinsStandingBefore: maskFromPins([7, 10]) }, 'throws_new_rack_is_full'],
    ['a split on a foul', { newRack: true, isFoul: true, isSplit: true }, 'throws_split_needs_legal_new_rack'],
    ['a split on a spare attempt', { isSplit: true }, 'throws_split_needs_legal_new_rack'],
    ['a mask out of range', { pinsKnocked: 1024 }, 'throws_knocked_range'],
    ['a fourth ball', { throwNumber: 4 }, 'throws_throw_number_range'],
    ['a board off the lane', { boardTarget: 40 }, 'throws_board_target_range'],
  ])('rejects %s', async (_, overrides, constraint) => {
    expect(await violation(db.insert(t.throws).values(await throwRow(overrides)))).toBe(constraint);
  });
});

describe('ownership', () => {
  it('refuses a game whose user differs from its session’s', async () => {
    const owner = await createUser(db);
    const intruder = await createUser(db);
    const sessionId = await createSession(db, owner);
    const insert = db.insert(t.games).values({ sessionId, userId: intruder, gameNumber: 1, totalScore: 0, isComplete: false });
    expect(await violation(insert)).toBe('games_session_fk');
  });

  it('refuses a throw whose user differs from its frame’s', async () => {
    const intruder = await createUser(db);
    expect(await violation(db.insert(t.throws).values({ ...(await throwRow()), userId: intruder }))).toBe('throws_frame_fk');
  });
});

describe('idempotency', () => {
  it('accepts a session once per client ID', async () => {
    const userId = await createUser(db);
    const values = { userId, clientId: randomUUID(), startedAt: new Date(), endedAt: new Date() };
    await db.insert(t.sessions).values(values);
    const retried = await db.insert(t.sessions).values(values).onConflictDoNothing().returning();
    expect(retried).toEqual([]);
    expect(await db.$count(t.sessions, eq(t.sessions.userId, userId))).toBe(1);
  });

  it('awards XP for a source once, so the derivation job can retry', async () => {
    const userId = await createUser(db);
    const award = { userId, sourceType: XpSource.session, sourceId: randomUUID(), amount: 120, formulaVersion: 1 };
    await db.insert(t.xpEvents).values(award);
    expect(await violation(db.insert(t.xpEvents).values(award))).toBe('xp_events_source_key');
  });
});

describe('deletion', () => {
  it('cascades a session to its games, frames and throws', async () => {
    const userId = await createUser(db);
    const sessionId = await createSession(db, userId);
    await insertScoredGame(db, userId, sessionId, PERFECT);
    await db.delete(t.sessions).where(eq(t.sessions.id, sessionId));
    expect(await db.$count(t.throws, eq(t.throws.userId, userId))).toBe(0);
    expect(await db.$count(t.frames, eq(t.frames.userId, userId))).toBe(0);
  });

  it('keeps history when a ball or a house is deleted', async () => {
    const userId = await createUser(db);
    const [house] = await db.insert(t.houses).values({ name: 'Sunway Megalanes', country: 'MY' }).returning();
    const [ball] = await db.insert(t.balls).values({ userId, name: 'Phaze II', weightLb: 15 }).returning();
    const [session] = await db
      .insert(t.sessions)
      .values({ userId, clientId: randomUUID(), houseId: house!.id, startedAt: new Date(), endedAt: new Date() })
      .returning();
    const gameId = await insertScoredGame(db, userId, session!.id, PERFECT);
    await db.update(t.games).set({ ballId: ball!.id }).where(eq(t.games.id, gameId));

    await db.delete(t.balls).where(eq(t.balls.id, ball!.id));
    await db.delete(t.houses).where(eq(t.houses.id, house!.id));

    const [game] = await db.select().from(t.games).where(eq(t.games.id, gameId));
    const [kept] = await db.select().from(t.sessions).where(eq(t.sessions.id, session!.id));
    expect(game!.ballId).toBeNull();
    expect(kept!.houseId).toBeNull();
  });

  it('removes everything a user owns when the account is deleted, except the audit log', async () => {
    const userId = await createUser(db);
    await insertScoredGame(db, userId, await createSession(db, userId), PERFECT);
    await db.insert(t.auditLog).values({ actorId: userId, action: 'account.delete', entity: 'user', entityId: userId });

    await db.execute(sql`DELETE FROM auth.users WHERE id = ${userId}`);

    expect(await db.$count(t.sessions, eq(t.sessions.userId, userId))).toBe(0);
    expect(await db.$count(t.throws, eq(t.throws.userId, userId))).toBe(0);
    expect(await db.$count(t.auditLog, eq(t.auditLog.actorId, userId))).toBe(1);
  });
});

describe('the audit log', () => {
  it.each([
    ['UPDATE', sql`UPDATE audit_log SET action = 'tampered'`],
    ['DELETE', sql`DELETE FROM audit_log`],
    ['TRUNCATE', sql`TRUNCATE audit_log`],
  ])('rejects %s', async (op, statement) => {
    await db.insert(t.auditLog).values({ action: 'score.rejected', entity: 'session' });
    expect(await violation(db.execute(statement))).toBe(`audit_log is append-only: ${op} is not allowed`);
  });
});

describe('profiles', () => {
  it.each(['Syah', 'ab', 'has space', 'a'.repeat(21)])('rejects the handle %j', async (handle) => {
    const userId = await createUser(db);
    expect(await violation(db.insert(t.profiles).values({ userId, handle, displayName: 'S' }))).toBe('profiles_handle_format');
  });

  it('accepts a valid handle once', async () => {
    const [a, b] = [await createUser(db), await createUser(db)];
    await db.insert(t.profiles).values({ userId: a, handle: 'syah_300', displayName: 'Syah' });
    expect(await violation(db.insert(t.profiles).values({ userId: b, handle: 'syah_300', displayName: 'Other' }))).toBe('profiles_handle_unique');
  });
});
