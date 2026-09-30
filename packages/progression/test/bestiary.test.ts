import { type DeliveryInput, FULL_RACK, type ScoredGame, maskFromPins, scoreGame, without } from '@bowling-rpg/scoring';
import { describe, expect, it } from 'vitest';
import { TIER_NAMES, buildBestiary, conversionRate, encountersIn, reportFor, tierFor } from '../src';

const pins = (...p: number[]) => maskFromPins(p);
const STRIKE: DeliveryInput = { knocked: FULL_RACK };
/** A first ball that leaves exactly these pins. */
const leave = (...p: number[]): DeliveryInput => ({ knocked: without(FULL_RACK, pins(...p)) });
/** A second ball that knocks exactly these pins. */
const hit = (...p: number[]): DeliveryInput => ({ knocked: pins(...p) });
const gutter: DeliveryInput = { knocked: 0 };

function scored(deliveries: DeliveryInput[]): ScoredGame {
  const result = scoreGame(deliveries);
  if (!result.ok) throw new Error(result.error.message);
  return result.game;
}

describe('encounters', () => {
  it('counts a converted and a missed spare, and ignores strikes', () => {
    const game = scored([leave(10), hit(10), STRIKE, leave(7, 10), hit(7)]);
    expect(encountersIn(game)).toEqual([
      { frameNumber: 1, leave: pins(10), converted: true, isSplit: false },
      { frameNumber: 3, leave: pins(7, 10), converted: false, isSplit: true },
    ]);
  });

  it('waits for the spare ball before counting a leave', () => {
    expect(encountersIn(scored([leave(10)]))).toEqual([]);
  });

  it('ignores a first-ball foul, whose pins are respotted', () => {
    expect(encountersIn(scored([{ knocked: pins(1, 2, 3), foul: true }, STRIKE]))).toEqual([]);
  });

  it('counts a foul on the spare ball as a miss', () => {
    expect(encountersIn(scored([leave(10), { knocked: pins(10), foul: true }]))).toEqual([
      { frameNumber: 1, leave: pins(10), converted: false, isSplit: false },
    ]);
  });

  it('counts a tenth-frame reset-rack leave, but not one on the final ball', () => {
    const nineOpen = Array.from({ length: 18 }, () => gutter);
    // Leaving the full rack on each gutter ball is itself a leave: 9 attempts, all missed.
    const reset = encountersIn(scored([...nineOpen, STRIKE, leave(7, 10), hit(7, 10)]));
    expect(reset.at(-1)).toEqual({ frameNumber: 10, leave: pins(7, 10), converted: true, isSplit: true });
    expect(reset).toHaveLength(10);

    const lastBall = encountersIn(scored([...nineOpen, STRIKE, STRIKE, leave(10)]));
    expect(lastBall).toHaveLength(9);
  });
});

describe('tiers', () => {
  it.each([
    [[7, 10], 'Boss'],
    [[4, 6, 7, 10], 'Boss'],
    [[4, 6, 7, 8, 10], 'Boss'],
    [[2, 7], 'Elite'],
    [[1, 2, 10], 'Trickster'],
    [[2, 4, 5, 8], 'Brute'],
    [[10], 'Minion'],
  ])('ranks %j as a %s', (leavePins, name) => {
    expect(TIER_NAMES[tierFor(pins(...leavePins))]).toBe(name);
  });
});

describe('the bestiary', () => {
  const g1 = { gameId: 'g1', scored: scored([leave(10), hit(10), leave(7, 10), gutter, leave(10), gutter]) };
  const g2 = { gameId: 'g2', scored: scored([leave(10), hit(10), leave(2, 4, 5, 8), hit(2, 4, 5, 8)]) };

  it('tallies every leave across games, most-faced first', () => {
    expect(buildBestiary([g1, g2])).toEqual([
      { leave: pins(10), name: undefined, kind: 'single', tier: 1, attempts: 3, conversions: 2, firstSeenGameId: 'g1', lastConvertedGameId: 'g2' },
      { leave: pins(2, 4, 5, 8), name: 'Bucket', kind: 'cluster', tier: 2, attempts: 1, conversions: 1, firstSeenGameId: 'g2', lastConvertedGameId: 'g2' },
      { leave: pins(7, 10), name: 'Bedposts', kind: 'split', tier: 5, attempts: 1, conversions: 0, firstSeenGameId: 'g1', lastConvertedGameId: null },
    ]);
  });

  it('is empty before any spare attempt', () => {
    expect(buildBestiary([])).toEqual([]);
  });

  it('computes a conversion rate, and zero with no attempts', () => {
    expect(conversionRate({ attempts: 3, conversions: 2 })).toBeCloseTo(2 / 3);
    expect(conversionRate({ attempts: 0, conversions: 0 })).toBe(0);
  });

  describe('the after-action report', () => {
    const bestiary = buildBestiary([g1, g2]);

    it('announces a leave only the first time it is ever faced, once per game', () => {
      const report = reportFor(g1, bestiary);
      expect(report.monsters.map((m) => [m.leave, m.converted, m.isNew])).toEqual([
        [pins(10), true, true],
        [pins(7, 10), false, true],
        [pins(10), false, false],
      ]);
      expect(reportFor(g2, bestiary).monsters.map((m) => [m.name, m.isNew])).toEqual([
        [undefined, false],
        ['Bucket', true],
      ]);
    });

    it('sums up the game', () => {
      expect(reportFor(g1, bestiary)).toMatchObject({
        score: 18 + 8 + 9, // spare + the 8 pins of the next ball, then 8, then 9
        isComplete: false,
        strikes: 0,
        spares: 1,
        openFrames: 2,
        splitsFaced: 1,
        splitsConverted: 0,
      });
    });

    it('counts strikes and converted splits', () => {
      const game = { gameId: 'g3', scored: scored([STRIKE, leave(7, 10), hit(7, 10)]) };
      expect(reportFor(game, buildBestiary([game]))).toMatchObject({ strikes: 1, spares: 1, splitsFaced: 1, splitsConverted: 1 });
    });
  });
});
