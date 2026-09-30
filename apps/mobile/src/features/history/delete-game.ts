import type { XpGain } from '@bowling-rpg/progression';
import { formatDay } from '@/lib/format';
import type { LoadedGame } from './load';

/**
 * The confirmation for deleting a game: which game, and exactly what goes with
 * it. XP isn't stored anywhere, so "removed" is literal: the next load
 * recomputes XP, level and stats without this game's balls.
 */
export function deleteGameConfirmation(game: LoadedGame, xp: XpGain): { title: string; message: string } {
  const which = `Game ${game.gameNumber} · ${formatDay(game.startedAt)} · ${game.scored.scoreSoFar}`;
  const effect =
    xp.xp > 0
      ? `Its ${xp.xp} XP and its stats will be removed, so your level may go down.`
      : 'It earned no XP, but its stats will be removed.';
  return { title: 'Delete this game?', message: `${which}\n\n${effect} This can’t be undone.` };
}
