import { randomUUID } from 'node:crypto';
import type { GamePayload, SessionId, UserId } from '@bowling-rpg/contracts';
import type { ScoredGame } from '@bowling-rpg/scoring';
import type { NewFrame, NewGame, NewThrow } from '../repositories/sessions';

export interface ScoredGamePayload {
  readonly payload: GamePayload;
  readonly scored: ScoredGame;
}

/**
 * Turns games the server has scored into rows. Pure: IDs are generated here so
 * child rows can reference parents without reading anything back.
 *
 * Every derived column (strike, spare, split, leave, scores) comes from the
 * server's own scoring run, never from the payload.
 */
export function buildGameRecords(userId: UserId, sessionId: SessionId, games: readonly ScoredGamePayload[]) {
  const gameRows: NewGame[] = [];
  const frameRows: NewFrame[] = [];
  const throwRows: NewThrow[] = [];

  for (const { payload, scored } of games) {
    const gameId = randomUUID();
    gameRows.push({
      id: gameId,
      sessionId,
      userId,
      gameNumber: payload.gameNumber,
      totalScore: scored.scoreSoFar,
      isComplete: scored.isComplete,
      ballId: payload.ballId ?? null,
    });

    for (const frame of scored.frames) {
      const frameId = randomUUID();
      frameRows.push({
        id: frameId,
        gameId,
        userId,
        frameNumber: frame.frameNumber,
        leaveMask: frame.firstBallLeave,
        isStrike: frame.isStrike,
        isSpare: frame.isSpare,
        isSplit: frame.isSplit,
        frameScore: frame.frameScore,
        cumulativeScore: frame.cumulativeScore,
      });

      for (const delivery of frame.deliveries) {
        // The engine keeps each delivery's position in the input, so this is the ball the phone sent.
        const sent = payload.deliveries[delivery.index]!;
        throwRows.push({
          frameId,
          userId,
          throwNumber: delivery.deliveryInFrame,
          pinsStandingBefore: delivery.standingBefore,
          pinsKnocked: delivery.knocked,
          isFoul: delivery.foul,
          newRack: delivery.newRack,
          isSplit: delivery.isSplit,
          ballId: sent.ballId ?? payload.ballId ?? null,
          boardTarget: sent.boardTarget ?? null,
          speedMph: sent.speedMph === undefined ? null : sent.speedMph.toFixed(1),
          thrownAt: new Date(sent.thrownAt),
        });
      }
    }
  }

  return { games: gameRows, frames: frameRows, throws: throwRows };
}
