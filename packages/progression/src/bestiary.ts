import {
  EMPTY,
  type LeaveKind,
  type PinMask,
  type ScoredGame,
  classifyLeave,
  leaveName,
  maskFromPins,
} from '@bowling-rpg/scoring';

/**
 * The bestiary: every leave a bowler has had to spare is a monster, and
 * converting it is a kill. Everything here is derived from scored games and
 * never stored as the only copy, so the rules can change and history is simply
 * recomputed.
 */

/** One spare attempt: a leave, and whether the next ball cleared it. */
export interface Encounter {
  readonly frameNumber: number;
  readonly leave: PinMask;
  readonly converted: boolean;
  readonly isSplit: boolean;
}

/**
 * Every spare attempt in a game. A leave counts when a legal ball at a fresh
 * rack left pins AND a ball was then thrown at them. That includes tenth-frame
 * reset racks, and excludes a leave on the last ball of a game, which nobody
 * gets to shoot at. A foul on the spare ball is a miss.
 */
export function encountersIn(game: ScoredGame): Encounter[] {
  const encounters: Encounter[] = [];
  for (const [i, ball] of game.deliveries.entries()) {
    if (!ball.newRack || ball.foul || ball.leave === EMPTY) continue;
    const attempt = game.deliveries[i + 1];
    if (!attempt) continue; // not thrown yet, or the game ended on this ball
    encounters.push({ frameNumber: ball.frameNumber, leave: ball.leave, converted: attempt.isSpare, isSplit: ball.isSplit });
  }
  return encounters;
}

// ---------------------------------------------------------------- tiers

export type Tier = 1 | 2 | 3 | 4 | 5;

/** Placeholder copy; tune freely. Tiers only affect presentation today. */
export const TIER_NAMES: Readonly<Record<Tier, string>> = {
  1: 'Minion',
  2: 'Brute',
  3: 'Trickster',
  4: 'Elite',
  5: 'Boss',
};

/** The splits every bowler has a story about. */
const BOSSES: ReadonlySet<number> = new Set([
  maskFromPins([7, 10]), // Bedposts
  maskFromPins([4, 6, 7, 10]), // Big Four
  maskFromPins([4, 6, 7, 9, 10]), // Greek Church
  maskFromPins([4, 6, 7, 8, 10]), // Greek Church
]);

const TIER_BY_KIND: Readonly<Record<LeaveKind, Tier>> = { clear: 1, single: 1, cluster: 2, washout: 3, split: 4 };

export function tierFor(leave: PinMask): Tier {
  return BOSSES.has(leave) ? 5 : TIER_BY_KIND[classifyLeave(leave)];
}

// ---------------------------------------------------------------- the bestiary

export interface PlayedGame {
  readonly gameId: string;
  readonly scored: ScoredGame;
}

export interface BestiaryEntry {
  readonly leave: PinMask;
  /** Traditional name ("Bedposts") when the leave has one. */
  readonly name: string | undefined;
  readonly kind: LeaveKind;
  readonly tier: Tier;
  readonly attempts: number;
  readonly conversions: number;
  readonly firstSeenGameId: string;
  readonly lastConvertedGameId: string | null;
}

/**
 * One entry per leave ever faced, most-faced first. `games` must be in the
 * order they were bowled, oldest first, so "first seen" means what it says.
 */
export function buildBestiary(games: readonly PlayedGame[]): BestiaryEntry[] {
  const entries = new Map<number, BestiaryEntry>();
  for (const { gameId, scored } of games) {
    for (const { leave, converted } of encountersIn(scored)) {
      const entry = entries.get(leave) ?? {
        leave,
        name: leaveName(leave),
        kind: classifyLeave(leave),
        tier: tierFor(leave),
        attempts: 0,
        conversions: 0,
        firstSeenGameId: gameId,
        lastConvertedGameId: null,
      };
      entries.set(leave, {
        ...entry,
        attempts: entry.attempts + 1,
        conversions: entry.conversions + (converted ? 1 : 0),
        lastConvertedGameId: converted ? gameId : entry.lastConvertedGameId,
      });
    }
  }
  return [...entries.values()].sort((a, b) => b.attempts - a.attempts || a.leave - b.leave);
}

export function conversionRate(entry: Pick<BestiaryEntry, 'attempts' | 'conversions'>): number {
  return entry.attempts === 0 ? 0 : entry.conversions / entry.attempts;
}

// ---------------------------------------------------------------- after-action report

export interface MonsterSighting extends Encounter {
  readonly name: string | undefined;
  readonly tier: Tier;
  /** The first time this bowler has ever faced this leave. */
  readonly isNew: boolean;
}

export interface GameReport {
  readonly score: number;
  readonly isComplete: boolean;
  readonly strikes: number;
  readonly spares: number;
  readonly openFrames: number;
  readonly splitsFaced: number;
  readonly splitsConverted: number;
  readonly monsters: readonly MonsterSighting[];
}

/** What a game was worth. `bestiary` must include this game, as built by buildBestiary. */
export function reportFor(game: PlayedGame, bestiary: readonly BestiaryEntry[]): GameReport {
  const firstSeenIn = new Map(bestiary.map((entry) => [entry.leave as number, entry.firstSeenGameId]));
  const encounters = encountersIn(game.scored);
  const announced = new Set<number>();

  const monsters = encounters.map((encounter): MonsterSighting => {
    const isNew = firstSeenIn.get(encounter.leave) === game.gameId && !announced.has(encounter.leave);
    announced.add(encounter.leave);
    return { ...encounter, name: leaveName(encounter.leave), tier: tierFor(encounter.leave), isNew };
  });

  const { deliveries, frames } = game.scored;
  return {
    score: game.scored.scoreSoFar,
    isComplete: game.scored.isComplete,
    strikes: deliveries.filter((d) => d.isStrike).length,
    spares: deliveries.filter((d) => d.isSpare).length,
    openFrames: frames.filter((f) => f.isOpen).length,
    splitsFaced: encounters.filter((e) => e.isSplit).length,
    splitsConverted: encounters.filter((e) => e.isSplit && e.converted).length,
    monsters,
  };
}
