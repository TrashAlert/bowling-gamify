import { randomUUID } from 'node:crypto';
import { ErrorEnvelope, SyncSessionsOutput } from '@bowling-rpg/contracts';
import { auditLog, balls, frames, games, houses, sessions, throws } from '@bowling-rpg/db';
import { maskFromPins } from '@bowling-rpg/scoring';
import { and, eq, isNotNull } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { GUTTER, PERFECT, TENTH_FRAME_SPLIT, ball, createTestApp, game, session } from './support';

let ctx: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  ctx = await createTestApp();
});

async function upload(token: string, batch: unknown[]) {
  const response = await ctx.sync(token, { sessions: batch });
  expect(response.statusCode, response.body).toBe(200);
  return SyncSessionsOutput.parse(response.json().result.data);
}

describe('accepting sessions', () => {
  it('stores a session scored by the server, with every game, frame and throw', async () => {
    const { userId, token } = await ctx.signIn();
    const upload1 = session([game(PERFECT, 300), game(GUTTER, 0, { gameNumber: 2 })]);
    const result = await upload(token, [upload1]);

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toEqual([{ clientId: upload1.clientId, serverId: expect.any(String) }]);

    const stored = await ctx.db.select().from(games).where(eq(games.userId, userId)).orderBy(games.gameNumber);
    expect(stored.map((g) => [g.totalScore, g.isComplete])).toEqual([[300, true], [0, true]]);
    expect(await ctx.db.$count(frames, eq(frames.userId, userId))).toBe(20);
    expect(await ctx.db.$count(throws, eq(throws.userId, userId))).toBe(12 + 20);
  });

  it('derives splits itself, including one on a tenth-frame reset rack', async () => {
    const { userId, token } = await ctx.signIn();
    await upload(token, [session([game(TENTH_FRAME_SPLIT, 19)])]);

    const splits = await ctx.db
      .select({ leaveMask: throws.leaveMask })
      .from(throws)
      .where(and(eq(throws.userId, userId), eq(throws.isSplit, true)));
    expect(splits).toEqual([{ leaveMask: maskFromPins([7, 10]) }]);
  });

  it('stores an abandoned game as incomplete', async () => {
    const { userId, token } = await ctx.signIn();
    await upload(token, [session([game(PERFECT.slice(0, 3), 30)])]);
    const [stored] = await ctx.db.select().from(games).where(eq(games.userId, userId));
    expect(stored).toMatchObject({ totalScore: 30, isComplete: false });
  });

  it('publishes SessionIngested once per new session', async () => {
    const { userId, token } = await ctx.signIn();
    const result = await upload(token, [session(), session()]);
    const mine = ctx.published.filter((e) => e.userId === userId);
    expect(mine.map((e) => e.sessionId).sort()).toEqual(result.accepted.map((a) => a.serverId).sort());
  });
});

describe('idempotency', () => {
  it('accepts a retried batch again without storing anything twice', async () => {
    const { userId, token } = await ctx.signIn();
    const batch = [session(), session([game(GUTTER, 0)])];

    const first = await upload(token, batch);
    const second = await upload(token, batch);

    expect(second).toEqual(first);
    expect(await ctx.db.$count(sessions, eq(sessions.userId, userId))).toBe(2);
    expect(await ctx.db.$count(throws, eq(throws.userId, userId))).toBe(12 + 20);
    expect(ctx.published.filter((e) => e.userId === userId)).toHaveLength(2);
  });

  it('scopes client IDs to their user', async () => {
    const alice = await ctx.signIn();
    const bob = await ctx.signIn();
    const shared = session();

    const [a, b] = [await upload(alice.token, [shared]), await upload(bob.token, [shared])];
    expect(a.accepted[0]!.serverId).not.toBe(b.accepted[0]!.serverId);
    expect(await ctx.db.$count(sessions, eq(sessions.userId, bob.userId))).toBe(1);
  });
});

describe('rejecting sessions', () => {
  it('rejects bad sessions one by one, stores the good one, and audits each rejection', async () => {
    const { userId, token } = await ctx.signIn();
    const good = session();
    const illegal = session([game([ball(maskFromPins([1, 2, 3])), ball(maskFromPins([1]))], 3)]);
    const misScored = session([game(PERFECT, 290)]);

    const result = await upload(token, [good, illegal, misScored]);

    expect(result.accepted.map((a) => a.clientId)).toEqual([good.clientId]);
    expect(result.rejected).toEqual([
      {
        clientId: illegal.clientId,
        code: 'SESSION_ILLEGAL_GAME',
        message: 'Game 1: Delivery 2: pins 1 were already down.',
        details: { gameNumber: 1, deliveryIndex: 1, scoringCode: 'PIN_NOT_STANDING' },
      },
      {
        clientId: misScored.clientId,
        code: 'SESSION_SCORE_MISMATCH',
        message: 'Game 1: recomputed score 300 does not match submitted 290',
        details: { gameNumber: 1, recomputed: 300, claimed: 290 },
      },
    ]);

    expect(await ctx.db.$count(sessions, eq(sessions.userId, userId))).toBe(1);
    const audit = await ctx.db.select().from(auditLog).where(eq(auditLog.actorId, userId));
    expect(audit.map((a) => [a.action, (a.metadata as { code: string }).code])).toEqual([
      ['sync.session_rejected', 'SESSION_ILLEGAL_GAME'],
      ['sync.session_rejected', 'SESSION_SCORE_MISMATCH'],
    ]);
  });

  it('refuses another user’s ball, reporting it exactly like one that doesn’t exist', async () => {
    const alice = await ctx.signIn();
    const bob = await ctx.signIn();
    const [bobsBall] = await ctx.db.insert(balls).values({ userId: bob.userId, name: 'Phaze II', weightLb: 15 }).returning();
    const missing = randomUUID();

    const result = await upload(alice.token, [session([game(PERFECT, 300, { ballId: bobsBall!.id })]), session([game(PERFECT, 300, { ballId: missing })])]);

    expect(result.rejected.map((r) => [r.code, r.details])).toEqual([
      ['SESSION_UNKNOWN_REFERENCE', { ballIds: [bobsBall!.id] }],
      ['SESSION_UNKNOWN_REFERENCE', { ballIds: [missing] }],
    ]);
  });

  it('records the user’s own balls on every throw, letting a delivery override the game’s', async () => {
    const { userId, token } = await ctx.signIn();
    const [strikeBall, spareBall] = await ctx.db
      .insert(balls)
      .values([
        { userId, name: 'Strike ball', weightLb: 15 },
        { userId, name: 'Spare ball', weightLb: 14 },
      ])
      .returning();
    const deliveries = [ball(maskFromPins([1, 2, 3, 4, 5, 6, 7, 8, 9])), ball(maskFromPins([10]), { ballId: spareBall!.id }), ...GUTTER.slice(2)];

    await upload(token, [session([game(deliveries, 10, { ballId: strikeBall!.id })])]);

    const rows = await ctx.db
      .select({ ballId: throws.ballId, throwNumber: throws.throwNumber })
      .from(throws)
      .innerJoin(frames, eq(throws.frameId, frames.id))
      .where(and(eq(throws.userId, userId), eq(frames.frameNumber, 1), isNotNull(throws.ballId)))
      .orderBy(throws.throwNumber);
    expect(rows).toEqual([
      { ballId: strikeBall!.id, throwNumber: 1 },
      { ballId: spareBall!.id, throwNumber: 2 },
    ]);
  });

  it('refuses an unknown house and oil pattern, and accepts a known house', async () => {
    const { token } = await ctx.signIn();
    const [house] = await ctx.db.insert(houses).values({ name: 'Sunway Megalanes', country: 'MY' }).returning();
    const unknownHouse = randomUUID();
    const unknownPattern = randomUUID();

    const result = await upload(token, [
      session(undefined, { houseId: house!.id }),
      session(undefined, { houseId: unknownHouse, oilPatternId: unknownPattern }),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0]!.details).toEqual({ houseId: unknownHouse, oilPatternId: unknownPattern });
  });
});

describe('request validation', () => {
  it('rejects a malformed batch with VALIDATION_FAILED and says where', async () => {
    const { token } = await ctx.signIn();
    const response = await ctx.sync(token, { sessions: [session([game([ball(1024)], 0)])] });

    expect(response.statusCode).toBe(400);
    const { error } = ErrorEnvelope.parse(response.json());
    expect(error.data.code).toBe('VALIDATION_FAILED');
    expect(error.data.details).toEqual({ issues: [{ path: 'sessions.0.games.0.deliveries.0.knocked', message: expect.any(String) }] });
    expect(error.data.traceId).toBe(response.headers['x-trace-id']);
  });

  it('rejects an empty batch', async () => {
    const { token } = await ctx.signIn();
    expect((await ctx.sync(token, { sessions: [] })).statusCode).toBe(400);
  });
});
