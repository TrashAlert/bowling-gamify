import { FULL_RACK, maskFromPins, scoreGame } from '@bowling-rpg/scoring';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ERROR_STATUS,
  ErrorCode,
  ErrorEnvelope,
  MAX_SESSIONS_PER_BATCH,
  SessionPayload,
  SyncSessionsInput,
  SyncSessionsOutput,
} from '../src';

const T0 = '2026-09-28T19:30:00+08:00';
const T1 = '2026-09-28T21:10:00+08:00';

const strike = { knocked: FULL_RACK as number, thrownAt: T0 };

function session(overrides: Record<string, unknown> = {}) {
  return {
    clientId: randomUUID(),
    startedAt: T0,
    endedAt: T1,
    games: [{ gameNumber: 1, claimedScore: 300, deliveries: Array.from({ length: 12 }, () => strike) }],
    ...overrides,
  };
}

describe('session payloads', () => {
  it('accepts a perfect game and hands deliveries straight to the scoring engine', () => {
    const parsed = SessionPayload.parse(session());
    const result = scoreGame(parsed.games[0]!.deliveries);
    expect(result).toMatchObject({ ok: true, game: { scoreSoFar: 300, isComplete: true } });
  });

  it('accepts the optional fields', () => {
    const ballId = randomUUID();
    const parsed = SessionPayload.parse(
      session({
        houseId: randomUUID(),
        games: [
          {
            gameNumber: 1,
            ballId,
            claimedScore: 9,
            deliveries: [{ knocked: maskFromPins([1, 2, 3, 4, 5, 6, 8, 9, 10]), foul: false, boardTarget: 10, speedMph: 17.2, thrownAt: T0 }],
          },
        ],
      }),
    );
    expect(parsed.games[0]!.ballId).toBe(ballId);
  });

  it.each([
    ['a mask above 1023', { knocked: 1024, thrownAt: T0 }],
    ['a fractional mask', { knocked: 1.5, thrownAt: T0 }],
    ['a board off the lane', { knocked: 0, boardTarget: 40, thrownAt: T0 }],
    ['a time with no offset', { knocked: 0, thrownAt: '2026-09-28T19:30:00' }],
  ])('rejects %s', (_, delivery) => {
    const input = session({ games: [{ gameNumber: 1, claimedScore: 0, deliveries: [delivery] }] });
    expect(SessionPayload.safeParse(input).success).toBe(false);
  });

  it('rejects a game with more balls than a game can have', () => {
    const input = session({ games: [{ gameNumber: 1, claimedScore: 0, deliveries: Array.from({ length: 22 }, () => strike) }] });
    expect(SessionPayload.safeParse(input).success).toBe(false);
  });

  it('rejects an end before the start', () => {
    expect(SessionPayload.safeParse(session({ endedAt: '2026-09-28T19:29:59+08:00' })).success).toBe(false);
  });

  it('compares times across offsets correctly', () => {
    // 12:00 UTC is 20:00 in Kuala Lumpur, so this ends after it starts.
    expect(SessionPayload.safeParse(session({ startedAt: '2026-09-28T19:30:00+08:00', endedAt: '2026-09-28T12:00:00Z' })).success).toBe(true);
  });

  it('rejects duplicate game numbers', () => {
    const game = { gameNumber: 1, claimedScore: 0, deliveries: [{ knocked: 0, thrownAt: T0 }] };
    const result = SessionPayload.safeParse(session({ games: [game, game] }));
    expect(result.error?.issues[0]?.path).toEqual(['games', 1, 'gameNumber']);
  });
});

describe('sync batches', () => {
  it(`accepts up to ${MAX_SESSIONS_PER_BATCH} sessions`, () => {
    const sessions = Array.from({ length: MAX_SESSIONS_PER_BATCH }, () => session());
    expect(SyncSessionsInput.safeParse({ sessions }).success).toBe(true);
    expect(SyncSessionsInput.safeParse({ sessions: [...sessions, session()] }).success).toBe(false);
  });

  it('rejects an empty batch', () => {
    expect(SyncSessionsInput.safeParse({ sessions: [] }).success).toBe(false);
  });

  it('rejects the same session twice in one batch', () => {
    const one = session();
    const result = SyncSessionsInput.safeParse({ sessions: [one, one] });
    expect(result.error?.issues[0]?.path).toEqual(['sessions', 1, 'clientId']);
  });

  it('shapes the response', () => {
    const clientId = randomUUID();
    const output = SyncSessionsOutput.parse({
      accepted: [{ clientId, serverId: randomUUID() }],
      rejected: [{ clientId: randomUUID(), code: 'SESSION_SCORE_MISMATCH', message: 'Recomputed 187, claimed 197' }],
      derivationJobId: 'job-1',
    });
    expect(output.accepted[0]!.clientId).toBe(clientId);
    expect(SyncSessionsOutput.safeParse({ ...output, rejected: [{ ...output.rejected[0], code: 'INTERNAL' }] }).success).toBe(false);
  });
});

describe('errors', () => {
  it('gives every code an HTTP status', () => {
    for (const code of ErrorCode.options) expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
  });

  it('parses the envelope', () => {
    const data = { code: 'SESSION_SCORE_MISMATCH', httpStatus: 409, details: { gameNumber: 2 }, traceId: '4bf92f3577b34da6' };
    const envelope = { error: { message: 'm', code: -32009, data } };
    expect(ErrorEnvelope.parse(envelope)).toEqual(envelope);
    expect(ErrorEnvelope.safeParse({ error: { ...envelope.error, data: { ...data, code: 'NOPE' } } }).success).toBe(false);
    // The tRPC client rejects a string here, so the schema must too.
    expect(ErrorEnvelope.safeParse({ error: { ...envelope.error, code: 'CONFLICT' } }).success).toBe(false);
  });
});
