import { type DeliveryInput, FULL_RACK, type ScoredGame, scoreGame } from '@bowling-rpg/scoring';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_XP_PER_GAME, buildProgression, levelFor, xpAtLevel, xpForGame, xpToLevelUp } from '../src';

function scored(deliveries: DeliveryInput[]): ScoredGame {
  const result = scoreGame(deliveries);
  if (!result.ok) throw new Error(result.error.message);
  return result.game;
}

const perfect = () => scored(Array.from({ length: 12 }, () => ({ knocked: FULL_RACK })));
/** Twenty balls of one pin each (pin 1, then pin 2, every frame): 20. */
const allOnes = () => scored(Array.from({ length: 20 }, (_, i) => ({ knocked: i % 2 === 0 ? 0b01 : 0b10 })));

describe('XP per game', () => {
  it('is the final score', () => {
    expect(xpForGame(allOnes())).toBe(20);
  });

  it('is 300 at most, for a perfect game', () => {
    expect(MAX_XP_PER_GAME).toBe(300);
    expect(xpForGame(perfect())).toBe(300);
  });

  it('is nothing for an unfinished game', () => {
    expect(xpForGame(scored([{ knocked: FULL_RACK }, { knocked: FULL_RACK }]))).toBe(0);
  });

  it('stays between 0 and 300 for any legal game', () => {
    // Random legal games: each ball knocks a random subset of what's standing.
    const game = fc.array(fc.integer({ min: 0, max: 1023 }), { minLength: 21, maxLength: 21 }).map((picks) => {
      const deliveries: DeliveryInput[] = [];
      for (const pick of picks) {
        const next = scoreGame(deliveries);
        if (!next.ok || !next.game.next) break;
        deliveries.push({ knocked: pick & next.game.next.standing });
      }
      return scored(deliveries);
    });
    fc.assert(
      fc.property(game, (g) => {
        const xp = xpForGame(g);
        return xp >= 0 && xp <= MAX_XP_PER_GAME && xp === g.scoreSoFar;
      }),
    );
  });
});

describe('the level curve', () => {
  it.each([
    [1, 0],
    [2, 500],
    [3, 1250],
    [5, 3500],
    [10, 13500],
    [20, 52250],
  ])('reaches level %i at %i XP', (level, xp) => {
    expect(xpAtLevel(level)).toBe(xp);
  });

  it('makes each level 250 XP longer than the last', () => {
    expect([1, 2, 3].map(xpToLevelUp)).toEqual([500, 750, 1000]);
    for (let level = 1; level < 50; level++) {
      expect(xpAtLevel(level + 1) - xpAtLevel(level)).toBe(xpToLevelUp(level));
    }
  });

  it('places any XP total within its level', () => {
    expect(levelFor(0)).toEqual({ level: 1, totalXp: 0, xpIntoLevel: 0, levelSize: 500, xpToNext: 500, fraction: 0 });
    expect(levelFor(499)).toMatchObject({ level: 1, xpToNext: 1 });
    expect(levelFor(500)).toMatchObject({ level: 2, xpIntoLevel: 0, xpToNext: 750 });
    expect(levelFor(1000)).toMatchObject({ level: 2, xpIntoLevel: 500, fraction: 500 / 750 });
  });
});

describe('progression', () => {
  it('replays games in order, recording each gain and level-up', () => {
    const games = [
      { gameId: 'a', scored: perfect() },
      { gameId: 'b', scored: allOnes() },
      { gameId: 'c', scored: perfect() },
      { gameId: 'd', scored: scored([{ knocked: FULL_RACK }]) },
    ];
    const { current, gains } = buildProgression(games);

    expect(gains.map((g) => [g.gameId, g.xp, g.before.totalXp, g.after.totalXp, g.levelsGained])).toEqual([
      ['a', 300, 0, 300, 0],
      ['b', 20, 300, 320, 0],
      ['c', 300, 320, 620, 1],
      ['d', 0, 620, 620, 0],
    ]);
    expect(current).toMatchObject({ level: 2, totalXp: 620, xpIntoLevel: 120 });
  });

  it('can gain several levels at once', () => {
    const big = Array.from({ length: 5 }, (_, i) => ({ gameId: String(i), scored: perfect() }));
    const { gains } = buildProgression(big);
    expect(gains.reduce((sum, g) => sum + g.levelsGained, 0)).toBe(levelFor(1500).level - 1);
  });

  it('starts at level 1 with nothing bowled', () => {
    expect(buildProgression([]).current.level).toBe(1);
  });
});
