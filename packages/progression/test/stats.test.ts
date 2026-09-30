import { type DeliveryInput, FULL_RACK, type ScoredGame, maskFromPins, scoreGame, without } from '@bowling-rpg/scoring';
import { describe, expect, it } from 'vitest';
import { type GameMetrics, compareForm, metricsFor, rollingForm, summarize } from '../src';

function scored(deliveries: DeliveryInput[]): ScoredGame {
  const result = scoreGame(deliveries);
  if (!result.ok) throw new Error(result.error.message);
  return result.game;
}

const STRIKE: DeliveryInput = { knocked: FULL_RACK };
const leave = (...p: number[]): DeliveryInput => ({ knocked: without(FULL_RACK, maskFromPins(p)) });
const hit = (...p: number[]): DeliveryInput => ({ knocked: maskFromPins(p) });

/** Metrics with just a score, for window arithmetic. */
const game = (score: number, extra: Partial<GameMetrics> = {}): GameMetrics => ({
  score,
  strikes: 0,
  strikeChances: 10,
  spares: 0,
  spareChances: 0,
  openFrames: 0,
  ...extra,
});

describe('one game', () => {
  it('counts a perfect game: 12 strikes from 12 chances, no spare chances', () => {
    const perfect = scored(Array.from({ length: 12 }, () => STRIKE));
    expect(metricsFor(perfect)).toEqual({ score: 300, strikes: 12, strikeChances: 12, spares: 0, spareChances: 0, openFrames: 0 });
  });

  it('counts spares made and missed, and open frames', () => {
    // Frames 1-9: a 10-pin leave, converted in the odd frames and missed in the even ones. Tenth: 9 and a miss.
    const frames = Array.from({ length: 9 }, (_, i) => [leave(10), i % 2 === 0 ? hit(10) : { knocked: 0 }]).flat();
    const metrics = metricsFor(scored([...frames, leave(10), { knocked: 0 }]));
    expect(metrics).toMatchObject({ strikes: 0, strikeChances: 10, spares: 5, spareChances: 10, openFrames: 5 });
  });
});

describe('summing games', () => {
  it('pools rates instead of averaging per-game percentages', () => {
    const form = summarize([
      game(200, { strikes: 9, strikeChances: 10, spares: 1, spareChances: 1 }),
      game(100, { strikes: 1, strikeChances: 10, spares: 0, spareChances: 9, openFrames: 9 }),
    ]);
    expect(form).toEqual({ games: 2, average: 150, strikeRate: 0.5, spareRate: 0.1, opensPerGame: 4.5 });
  });

  it('gives no rate without chances, and zeros without games', () => {
    expect(summarize([game(300, { spareChances: 0 })]).spareRate).toBeNull();
    expect(summarize([])).toEqual({ games: 0, average: 0, strikeRate: null, spareRate: null, opensPerGame: 0 });
  });

  it('rolls a trailing window over each game', () => {
    const rolling = rollingForm([game(100), game(200), game(150), game(250)], 3);
    expect(rolling.map((f) => [f.games, f.average])).toEqual([
      [1, 100],
      [2, 150],
      [3, 150],
      [3, 200],
    ]);
  });

  it('rolls five games by default', () => {
    expect(rollingForm(Array.from({ length: 7 }, (_, i) => game(i))).at(-1)?.games).toBe(5);
  });
});

describe('recent vs before', () => {
  it('compares the last 10 games with the 10 before them', () => {
    const games = [...Array.from({ length: 5 }, () => game(90)), ...Array.from({ length: 10 }, () => game(150)), ...Array.from({ length: 10 }, () => game(180))];
    const comparison = compareForm(games);
    expect(comparison).toMatchObject({ window: 10, recent: { games: 10, average: 180 }, previous: { games: 10, average: 150 } });
  });

  it('splits fewer than 20 games in half, leaving out the oldest odd game', () => {
    // 7 games: window 3. Recent is 200-220, previous is the three just before (110-130); 100 sits out.
    const comparison = compareForm([game(100), game(110), game(120), game(130), game(200), game(210), game(220)]);
    expect(comparison).toMatchObject({ window: 3, recent: { average: 210 }, previous: { average: 120 } });
  });

  it('needs at least four games', () => {
    expect(compareForm([game(1), game(2), game(3)])).toBeNull();
  });
});
