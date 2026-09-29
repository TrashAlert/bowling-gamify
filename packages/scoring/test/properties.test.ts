import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FULL_RACK, mirrorPins, type PinMask } from '../src/pins';
import { type DeliveryInput, MAX_DELIVERIES, PERFECT_GAME, maxPossibleScore } from '../src/scoring';
import { score } from './helpers';

/**
 * A ball is a random subset of whatever is standing, biased toward clearing the
 * rack so strikes and spares actually show up, plus the occasional foul.
 */
const arbBall = fc.record({
  subset: fc.oneof(
    { arbitrary: fc.constant(FULL_RACK as number), weight: 2 },
    { arbitrary: fc.integer({ min: 0, max: 1023 }), weight: 3 },
  ),
  foul: fc.integer({ min: 0, max: 24 }).map((n) => n === 0),
});

/** Play balls until the game ends. 21 balls always finish a game. */
function play(balls: readonly { subset: number; foul: boolean }[]): DeliveryInput[] {
  const input: DeliveryInput[] = [];
  for (const ball of balls) {
    const next = score(input).next;
    if (!next) break;
    input.push({ knocked: ball.subset & next.standing, foul: ball.foul });
  }
  return input;
}

const arbGame = fc.array(arbBall, { minLength: MAX_DELIVERIES, maxLength: MAX_DELIVERIES }).map(play);

const RUNS = { numRuns: 2000 };

describe('every legal game', () => {
  it('finishes with ten scored frames and a total between 0 and 300', () => {
    fc.assert(
      fc.property(arbGame, (input) => {
        const game = score(input);
        expect(game.isComplete).toBe(true);
        expect(game.frames).toHaveLength(10);
        expect(input.length).toBeGreaterThanOrEqual(11);
        expect(input.length).toBeLessThanOrEqual(MAX_DELIVERIES);
        expect(game.scoreSoFar).toBeGreaterThanOrEqual(0);
        expect(game.scoreSoFar).toBeLessThanOrEqual(PERFECT_GAME);

        let previous = 0;
        for (const frame of game.frames) {
          expect(frame.isComplete).toBe(true);
          expect(frame.frameScore).not.toBeNull();
          expect(frame.frameScore!).toBeLessThanOrEqual(30);
          expect(frame.cumulativeScore!).toBeGreaterThanOrEqual(previous);
          previous = frame.cumulativeScore!;
        }
        const sum = game.frames.reduce((acc, f) => acc + f.frameScore!, 0);
        expect(sum).toBe(game.scoreSoFar);
      }),
      RUNS,
    );
  });

  it('only ever leaves a pending suffix of frames', () => {
    fc.assert(
      fc.property(arbGame, fc.nat(MAX_DELIVERIES), (input, cut) => {
        const frames = score(input.slice(0, cut)).frames;
        const firstPending = frames.findIndex((f) => f.cumulativeScore === null);
        if (firstPending === -1) return;
        for (const later of frames.slice(firstPending)) expect(later.cumulativeScore).toBeNull();
      }),
      RUNS,
    );
  });

  it('never lets the best reachable score rise, and lands on the final score', () => {
    fc.assert(
      fc.property(arbGame, (input) => {
        let ceiling = PERFECT_GAME;
        for (let cut = 0; cut <= input.length; cut++) {
          const game = score(input.slice(0, cut));
          const best = maxPossibleScore(game);
          expect(best).toBeLessThanOrEqual(ceiling);
          expect(best).toBeGreaterThanOrEqual(game.scoreSoFar);
          ceiling = best;
        }
        expect(ceiling).toBe(score(input).scoreSoFar);
      }),
      { numRuns: 300 },
    );
  });

  it('never counts pins on a foul, and respots them for the next ball in the frame', () => {
    fc.assert(
      fc.property(arbGame, (input) => {
        const { deliveries } = score(input);
        for (const [i, d] of deliveries.entries()) {
          if (!d.foul) continue;
          expect(d.pinfall).toBe(0);
          expect(d.isStrike || d.isSpare || d.isSplit).toBe(false);
          const next = deliveries[i + 1];
          if (next && next.frameNumber === d.frameNumber) {
            expect(next.standingBefore).toBe(d.standingBefore);
          }
        }
      }),
      RUNS,
    );
  });

  it('scores a mirrored game identically', () => {
    fc.assert(
      fc.property(arbGame, (input) => {
        const mirrored = input.map((d) => ({ ...d, knocked: mirrorPins(d.knocked as PinMask) }));
        const a = score(input);
        const b = score(mirrored);
        expect(b.frames.map((f) => f.frameScore)).toEqual(a.frames.map((f) => f.frameScore));
        expect(b.deliveries.map((d) => [d.isStrike, d.isSpare, d.isSplit])).toEqual(
          a.deliveries.map((d) => [d.isStrike, d.isSpare, d.isSplit]),
        );
      }),
      RUNS,
    );
  });
});
