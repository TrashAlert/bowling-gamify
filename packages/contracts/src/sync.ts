import { MAX_DELIVERIES, PERFECT_GAME } from '@bowling-rpg/scoring';
import { z } from 'zod';
import { ErrorCode } from './errors';
import { BallId, ClientSessionId, HouseId, OilPatternId, PinMaskSchema, SessionId, Timestamp } from './primitives';

/** Sessions per sync upload. A heavy user syncs a handful a week. */
export const MAX_SESSIONS_PER_BATCH = 20;

/**
 * Games per session. The schema doesn't cap this; the API does, so a looping
 * client can't upload a 10,000-game session. A long practice day is ~15.
 */
export const MAX_GAMES_PER_SESSION = 30;

/**
 * One ball, as the bowler logged it. The client sends raw deliveries only.
 * Frames, strikes, spares, splits and scores are all recomputed on the server
 * by `@bowling-rpg/scoring`, so there is nothing derived here to disagree about.
 */
export const DeliveryPayload = z.object({
  /** Pins that fell on this ball. */
  knocked: PinMaskSchema,
  /** A foul counts zero, and the pins that fell are respotted. */
  foul: z.boolean().optional(),
  /** Overrides the game's ball for this delivery (e.g. a spare ball). */
  ballId: BallId.optional(),
  /** Target board at the arrows, 1-39. */
  boardTarget: z.int().min(1).max(39).optional(),
  speedMph: z.number().positive().max(40).optional(),
  thrownAt: Timestamp,
});

export const GamePayload = z.object({
  gameNumber: z.int().min(1).max(MAX_GAMES_PER_SESSION),
  /** The ball used unless a delivery says otherwise. */
  ballId: BallId.optional(),
  /**
   * The score the phone showed. The server never trusts it: it recomputes the
   * game and rejects the session on a mismatch, which flags a client scoring bug
   * or a forged submission.
   */
  claimedScore: z.int().min(0).max(PERFECT_GAME),
  /** Fewer than a full game means the game was abandoned. */
  deliveries: z.array(DeliveryPayload).min(1).max(MAX_DELIVERIES),
});

export const SessionPayload = z
  .object({
    clientId: ClientSessionId,
    startedAt: Timestamp,
    endedAt: Timestamp,
    houseId: HouseId.optional(),
    oilPatternId: OilPatternId.optional(),
    games: z.array(GamePayload).min(1).max(MAX_GAMES_PER_SESSION),
  })
  .superRefine((session, ctx) => {
    if (Date.parse(session.endedAt) < Date.parse(session.startedAt)) {
      ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'endedAt is before startedAt' });
    }
    const seen = new Set<number>();
    for (const [i, game] of session.games.entries()) {
      if (seen.has(game.gameNumber)) {
        ctx.addIssue({ code: 'custom', path: ['games', i, 'gameNumber'], message: `Duplicate game number ${game.gameNumber}` });
      }
      seen.add(game.gameNumber);
    }
  });

/**
 * `POST /v1/sync/sessions`. Only structure is checked here: a session whose
 * games are illegal or mis-scored is rejected on its own by the ingest service,
 * so one bad session never rejects the other nineteen.
 */
export const SyncSessionsInput = z
  .object({
    sessions: z.array(SessionPayload).min(1).max(MAX_SESSIONS_PER_BATCH),
  })
  .superRefine((batch, ctx) => {
    const seen = new Set<string>();
    for (const [i, session] of batch.sessions.entries()) {
      if (seen.has(session.clientId)) {
        ctx.addIssue({ code: 'custom', path: ['sessions', i, 'clientId'], message: 'Duplicate clientId in batch' });
      }
      seen.add(session.clientId);
    }
  });

/**
 * Why one session in a batch was refused. Neither is fixed by retrying: the
 * client stops resending the session, keeps it on the phone, and flags it.
 */
export const SessionRejectionCode = ErrorCode.extract(['SESSION_ILLEGAL_GAME', 'SESSION_SCORE_MISMATCH']);

export const SyncSessionsOutput = z.object({
  /** Includes sessions the server already had. A retried upload is accepted again, not rejected. */
  accepted: z.array(z.object({ clientId: ClientSessionId, serverId: SessionId })),
  rejected: z.array(z.object({ clientId: ClientSessionId, code: SessionRejectionCode, message: z.string() })),
  /** Null when nothing new was accepted, so there is nothing to derive. */
  derivationJobId: z.string().nullable(),
});

export type DeliveryPayload = z.infer<typeof DeliveryPayload>;
export type GamePayload = z.infer<typeof GamePayload>;
export type SessionPayload = z.infer<typeof SessionPayload>;
export type SyncSessionsInput = z.infer<typeof SyncSessionsInput>;
export type SyncSessionsOutput = z.infer<typeof SyncSessionsOutput>;
