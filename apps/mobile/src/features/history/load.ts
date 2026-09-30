import {
  type BestiaryEntry,
  type Encounter,
  type GameReport,
  type Progression,
  type XpGain,
  buildBestiary,
  buildProgression,
  encountersIn,
  reportFor,
} from '@bowling-rpg/progression';
import { type PinMask, type ScoredGame, scoreGame } from '@bowling-rpg/scoring';
import { type Db, type RecentGame, fetchAllGames } from '@/db/games';

export interface LoadedGame extends RecentGame {
  readonly scored: ScoredGame;
}

export interface History {
  /** Oldest first. */
  readonly games: readonly LoadedGame[];
  readonly bestiary: readonly BestiaryEntry[];
  readonly progression: Progression;
}

/**
 * Everything derived from the stored balls: scores, bestiary, XP and level.
 * Nothing derived is saved, so a rule change in @bowling-rpg/progression
 * applies to all of history on the next load. At a heavy bowler's ~150 games
 * a year this is a few thousand rows: milliseconds.
 */
export async function loadHistory(db: Db): Promise<History> {
  const games: LoadedGame[] = [];
  for (const game of await fetchAllGames(db)) {
    const result = scoreGame(game.deliveries);
    if (result.ok) games.push({ ...game, scored: result.game });
  }
  return { games, bestiary: buildBestiary(games), progression: buildProgression(games) };
}

export interface Attempt {
  readonly game: LoadedGame;
  readonly encounter: Encounter;
}

/** Every attempt at one leave, newest first. */
export function attemptsAt(history: History, leave: PinMask): Attempt[] {
  const attempts: Attempt[] = [];
  for (const game of history.games) {
    for (const encounter of encountersIn(game.scored)) {
      if (encounter.leave === leave) attempts.push({ game, encounter });
    }
  }
  return attempts.reverse();
}

export interface LoadedReport {
  readonly game: LoadedGame;
  readonly report: GameReport;
  readonly xp: XpGain;
}

/** One game's after-action report, with the XP it earned and the level it left you on. */
export async function loadGameReport(db: Db, gameId: string): Promise<LoadedReport | null> {
  const history = await loadHistory(db);
  const index = history.games.findIndex((g) => g.gameId === gameId);
  const game = history.games[index];
  const xp = history.progression.gains[index];
  return game && xp ? { game, report: reportFor(game, history.bestiary), xp } : null;
}
