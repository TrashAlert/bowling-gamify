import type { ScoredGame } from '@bowling-rpg/scoring';
import { encountersIn } from './bestiary';

/**
 * Improvement stats over finished games. Rates are pooled (total made ÷ total
 * chances across the games), not averages of per-game percentages, so a game
 * with one spare chance can't swing a rate as much as a game with nine.
 */

/** The raw counts one game contributes. */
export interface GameMetrics {
  readonly score: number;
  /** Strikes thrown, including tenth-frame fill balls at a fresh rack. */
  readonly strikes: number;
  /** Balls thrown at a fresh rack: every chance to strike. */
  readonly strikeChances: number;
  /** Leaves converted. */
  readonly spares: number;
  /** Leaves shot at: every chance to spare. */
  readonly spareChances: number;
  readonly openFrames: number;
}

export function metricsFor(game: ScoredGame): GameMetrics {
  const encounters = encountersIn(game);
  return {
    score: game.scoreSoFar,
    strikes: game.deliveries.filter((d) => d.isStrike).length,
    strikeChances: game.deliveries.filter((d) => d.newRack).length,
    spares: encounters.filter((e) => e.converted).length,
    spareChances: encounters.length,
    openFrames: game.frames.filter((f) => f.isOpen).length,
  };
}

/** A stretch of games summed up. Rates are 0..1, or null with no chances at all. */
export interface Form {
  readonly games: number;
  readonly average: number;
  readonly strikeRate: number | null;
  readonly spareRate: number | null;
  readonly opensPerGame: number;
}

export function summarize(games: readonly GameMetrics[]): Form {
  const sum = (pick: (m: GameMetrics) => number) => games.reduce((total, m) => total + pick(m), 0);
  const rate = (made: number, chances: number) => (chances === 0 ? null : made / chances);
  const n = games.length;
  return {
    games: n,
    average: n === 0 ? 0 : sum((m) => m.score) / n,
    strikeRate: rate(sum((m) => m.strikes), sum((m) => m.strikeChances)),
    spareRate: rate(sum((m) => m.spares), sum((m) => m.spareChances)),
    opensPerGame: n === 0 ? 0 : sum((m) => m.openFrames) / n,
  };
}

/** Games in a rolling window: enough to smooth one bad night, few enough to show a change. */
export const ROLLING_GAMES = 5;

/** For each game, the form over it and up to `size - 1` games before it. */
export function rollingForm(games: readonly GameMetrics[], size: number = ROLLING_GAMES): Form[] {
  return games.map((_, i) => summarize(games.slice(Math.max(0, i + 1 - size), i + 1)));
}

/** The most games compared on each side of "recent vs before". */
export const COMPARE_GAMES = 10;

export interface FormComparison {
  /** Games on each side: 10, or half the games bowled if fewer than 20. */
  readonly window: number;
  readonly recent: Form;
  readonly previous: Form;
}

/**
 * The latest games against the same number just before them. Null with fewer
 * than 4 finished games: two against two is the least that says anything.
 */
export function compareForm(games: readonly GameMetrics[], max: number = COMPARE_GAMES): FormComparison | null {
  const window = Math.min(max, Math.floor(games.length / 2));
  if (window < 2) return null;
  return {
    window,
    recent: summarize(games.slice(-window)),
    previous: summarize(games.slice(-2 * window, -window)),
  };
}
