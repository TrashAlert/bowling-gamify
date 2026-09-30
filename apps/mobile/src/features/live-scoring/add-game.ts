import { type ScoredGame, scoreGame } from '@bowling-rpg/scoring';
import { type Db, fetchCurrentGame, fetchOpenSessionId, startNextGame, startSession } from '@/db/games';

export interface GameInProgress {
  readonly sessionId: string;
  readonly gameNumber: number;
  readonly scored: ScoredGame;
}

/** An unfinished game in the open session: one the bowler started and backed out of. */
export async function findGameInProgress(db: Db): Promise<GameInProgress | null> {
  const sessionId = await fetchOpenSessionId(db);
  if (!sessionId) return null;
  const current = await fetchCurrentGame(db, sessionId);
  const result = current ? scoreGame(current.deliveries) : null;
  if (!current || !result?.ok || result.game.isComplete) return null;
  return { sessionId, gameNumber: current.gameNumber, scored: result.game };
}

/**
 * What the "+" button does, returning the session to open:
 * - no session open: start one, with game 1;
 * - the open session's last game is finished: add the next game;
 * - a game is still being bowled: go back to it, since two unfinished games at
 *   once would only be confusing.
 */
export async function addGame(db: Db, now: Date = new Date()): Promise<string> {
  const sessionId = await fetchOpenSessionId(db);
  if (!sessionId) return (await startSession(db, now)).sessionId;
  if (!(await findGameInProgress(db))) await startNextGame(db, sessionId);
  return sessionId;
}
