import {
  type BestiaryEntry,
  type Encounter,
  type Form,
  type GameMetrics,
  type GameReport,
  type Progression,
  type XpGain,
  buildBestiary,
  buildProgression,
  encountersIn,
  metricsFor,
  reportFor,
  rollingForm,
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

export interface GameStats {
  /** Finished games; unfinished ones earn no XP and don't count. */
  readonly games: number;
  readonly average: number;
  readonly best: number;
}

/** Progress's numbers, over finished games only. Average is rounded to a whole pin. */
export function gameStats(history: History): GameStats {
  const scores = history.games.filter((g) => g.scored.isComplete).map((g) => g.scored.scoreSoFar);
  const total = scores.reduce((sum, score) => sum + score, 0);
  return {
    games: scores.length,
    average: scores.length === 0 ? 0 : Math.round(total / scores.length),
    best: scores.reduce((max, score) => Math.max(max, score), 0),
  };
}

/** One finished game on the Progress charts. */
export interface ProgressPoint {
  readonly game: LoadedGame;
  readonly metrics: GameMetrics;
  /** Form over this game and the few before it. */
  readonly rolling: Form;
}

/** Finished games, oldest first, with their counts and rolling form. */
export function progressPoints(history: History): ProgressPoint[] {
  const finished = history.games.filter((g) => g.scored.isComplete);
  const metrics = finished.map((g) => metricsFor(g.scored));
  const rolling = rollingForm(metrics);
  return finished.map((game, i) => ({ game, metrics: metrics[i]!, rolling: rolling[i]! }));
}

/** Game ID → the level it took the bowler to, for games that levelled them up. */
export function levelsReached(history: History): ReadonlyMap<string, number> {
  const reached = new Map<string, number>();
  for (const gain of history.progression.gains) {
    if (gain.levelsGained > 0) reached.set(gain.gameId, gain.after.level);
  }
  return reached;
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
