import { PERFECT_GAME, type ScoredGame } from '@bowling-rpg/scoring';
import type { PlayedGame } from './bestiary';

/**
 * XP and levels.
 *
 * A game is worth its score in XP, so a perfect game is the most any game can
 * earn: 300. Only completed games count; an abandoned game earns nothing.
 *
 * XP is always derived from raw balls and never stored as the only copy. Bump
 * XP_FORMULA_VERSION whenever a number here changes, so a stored snapshot (on
 * the server, later) can tell which rules produced it.
 */
export const XP_FORMULA_VERSION = 1;

export const MAX_XP_PER_GAME = PERFECT_GAME;

/** XP to go from level 1 to 2. */
const FIRST_LEVEL_XP = 500;
/** How much longer each level is than the one before. */
const LEVEL_XP_STEP = 250;

export function xpForGame(game: ScoredGame): number {
  return game.isComplete ? Math.min(game.scoreSoFar, MAX_XP_PER_GAME) : 0;
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToLevelUp(level: number): number {
  return FIRST_LEVEL_XP + LEVEL_XP_STEP * (level - 1);
}

/** Total XP at which `level` is reached. Level 1 starts at 0. */
export function xpAtLevel(level: number): number {
  const n = level - 1;
  return FIRST_LEVEL_XP * n + (LEVEL_XP_STEP * n * (n - 1)) / 2;
}

export interface LevelProgress {
  readonly level: number;
  readonly totalXp: number;
  /** XP earned since reaching this level. */
  readonly xpIntoLevel: number;
  /** The size of this level: xpIntoLevel + xpToNext. */
  readonly levelSize: number;
  readonly xpToNext: number;
  /** 0 to just under 1: how far through this level. */
  readonly fraction: number;
}

export function levelFor(totalXp: number): LevelProgress {
  let level = 1;
  while (totalXp >= xpAtLevel(level + 1)) level++;
  const xpIntoLevel = totalXp - xpAtLevel(level);
  const levelSize = xpToLevelUp(level);
  return { level, totalXp, xpIntoLevel, levelSize, xpToNext: levelSize - xpIntoLevel, fraction: xpIntoLevel / levelSize };
}

export interface XpGain {
  readonly gameId: string;
  readonly xp: number;
  readonly before: LevelProgress;
  readonly after: LevelProgress;
  readonly levelsGained: number;
}

export interface Progression {
  readonly current: LevelProgress;
  /** One per game, in the order given. Unfinished games appear with 0 XP. */
  readonly gains: readonly XpGain[];
}

/** Replays every game in the order it was bowled, oldest first. */
export function buildProgression(games: readonly PlayedGame[]): Progression {
  let current = levelFor(0);
  const gains: XpGain[] = [];
  for (const { gameId, scored } of games) {
    const xp = xpForGame(scored);
    const after = levelFor(current.totalXp + xp);
    gains.push({ gameId, xp, before: current, after, levelsGained: after.level - current.level });
    current = after;
  }
  return { current, gains };
}
