import type { SessionId, SessionPayload, SyncSessionsOutput, UserId } from '@bowling-rpg/contracts';
import type { Database } from '@bowling-rpg/db';
import { scoreGame } from '@bowling-rpg/scoring';
import type { EventBus } from '../events/bus';
import { insertAuditEntry } from '../repositories/audit';
import { fetchOwnedBallIds, houseExists, oilPatternExists } from '../repositories/references';
import { fetchSessionIdByClientId, insertGameRecords, insertSessionIfAbsent } from '../repositories/sessions';
import { type ScoredGamePayload, buildGameRecords } from './game-records';

export interface IngestDeps {
  readonly db: Database;
  readonly events: EventBus;
}

export interface RequestMeta {
  readonly ip: string | null;
}

type Rejection = SyncSessionsOutput['rejected'][number];
type Outcome =
  | { readonly ok: true; readonly sessionId: SessionId; readonly isNew: boolean }
  | { readonly ok: false; readonly rejection: Omit<Rejection, 'clientId'> };

const reject = (code: Rejection['code'], message: string, details: Record<string, unknown>): Outcome => ({
  ok: false,
  rejection: { code, message, details },
});

/**
 * Accepts a batch of finished sessions from the phone.
 *
 * Each session stands alone: it's accepted or rejected on its own merits and
 * committed in its own transaction, so one bad session never costs the others.
 * A session the server already has is accepted again with its existing ID,
 * which makes a retried upload free.
 *
 * Expected problems (an illegal game, a wrong score, an unknown ball) are
 * rejections. Anything else throws, and the client retries the whole batch;
 * sessions committed before the failure come back as already accepted.
 */
export async function ingestSessions(
  deps: IngestDeps,
  userId: UserId,
  sessions: readonly SessionPayload[],
  meta: RequestMeta,
): Promise<SyncSessionsOutput> {
  const accepted: SyncSessionsOutput['accepted'] = [];
  const rejected: SyncSessionsOutput['rejected'] = [];

  for (const session of sessions) {
    const outcome = await ingestSession(deps.db, userId, session);

    if (outcome.ok) {
      accepted.push({ clientId: session.clientId, serverId: outcome.sessionId });
      // Published per session, right after its commit: if a later session in the
      // batch throws, this one is still derived, and a retry won't publish it again.
      if (outcome.isNew) await deps.events.publish({ type: 'SessionIngested', userId, sessionId: outcome.sessionId });
      continue;
    }

    rejected.push({ clientId: session.clientId, ...outcome.rejection });
    // Rejections are how you tell a client scoring bug from a cheater, so keep every one.
    await insertAuditEntry(deps.db, {
      actorId: userId,
      action: 'sync.session_rejected',
      entity: 'session',
      ip: meta.ip,
      metadata: { clientId: session.clientId, code: outcome.rejection.code, details: outcome.rejection.details },
    });
  }

  return { accepted, rejected, derivationJobId: null };
}

async function ingestSession(db: Database, userId: UserId, session: SessionPayload): Promise<Outcome> {
  const existing = await fetchSessionIdByClientId(db, userId, session.clientId);
  if (existing) return { ok: true, sessionId: existing, isNew: false };

  const scoredGames: ScoredGamePayload[] = [];
  for (const game of session.games) {
    const result = scoreGame(game.deliveries);
    if (!result.ok) {
      return reject('SESSION_ILLEGAL_GAME', `Game ${game.gameNumber}: ${result.error.message}`, {
        gameNumber: game.gameNumber,
        deliveryIndex: result.error.deliveryIndex,
        scoringCode: result.error.code,
      });
    }
    if (result.game.scoreSoFar !== game.claimedScore) {
      return reject(
        'SESSION_SCORE_MISMATCH',
        `Game ${game.gameNumber}: recomputed score ${result.game.scoreSoFar} does not match submitted ${game.claimedScore}`,
        { gameNumber: game.gameNumber, recomputed: result.game.scoreSoFar, claimed: game.claimedScore },
      );
    }
    scoredGames.push({ payload: game, scored: result.game });
  }

  const unknown = await findUnknownReferences(db, userId, session);
  if (unknown) return reject('SESSION_UNKNOWN_REFERENCE', 'The session refers to a ball, house or oil pattern the server does not know.', unknown);

  return db.transaction(async (tx): Promise<Outcome> => {
    const sessionId = await insertSessionIfAbsent(tx, {
      userId,
      clientId: session.clientId,
      houseId: session.houseId ?? null,
      oilPatternId: session.oilPatternId ?? null,
      startedAt: new Date(session.startedAt),
      endedAt: new Date(session.endedAt),
    });
    if (!sessionId) {
      // The same session arrived twice at once, and the other request committed first.
      const winner = await fetchSessionIdByClientId(tx, userId, session.clientId);
      return { ok: true, sessionId: winner!, isNew: false };
    }
    await insertGameRecords(tx, buildGameRecords(userId, sessionId, scoredGames));
    return { ok: true, sessionId, isNew: true };
  });
}

/** Null when every reference resolves. Balls must also belong to this user. */
async function findUnknownReferences(db: Database, userId: UserId, session: SessionPayload): Promise<Record<string, unknown> | null> {
  const ballIds = new Set<string>();
  for (const game of session.games) {
    if (game.ballId) ballIds.add(game.ballId);
    for (const delivery of game.deliveries) if (delivery.ballId) ballIds.add(delivery.ballId);
  }

  const owned = await fetchOwnedBallIds(db, userId, [...ballIds]);
  const unknown: Record<string, unknown> = {};
  const unknownBalls = [...ballIds].filter((id) => !owned.has(id));
  if (unknownBalls.length > 0) unknown['ballIds'] = unknownBalls;
  if (session.houseId && !(await houseExists(db, session.houseId))) unknown['houseId'] = session.houseId;
  if (session.oilPatternId && !(await oilPatternExists(db, session.oilPatternId))) unknown['oilPatternId'] = session.oilPatternId;

  return Object.keys(unknown).length > 0 ? unknown : null;
}
