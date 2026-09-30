import { FULL_RACK, type NextDelivery, type PinMask, maskFromPins, scoreGame } from '@bowling-rpg/scoring';
import { markFor, primaryAction, toDelivery } from '@/features/live-scoring/entry';
import { uuidv7 } from '@/lib/uuid';

const pins = (...p: number[]) => maskFromPins(p);
const firstBall: NextDelivery = { frameNumber: 1, deliveryInFrame: 1, standing: FULL_RACK, newRack: true };
const secondBall = (standing: PinMask): NextDelivery => ({ frameNumber: 1, deliveryInFrame: 2, standing, newRack: false });

describe('recording a ball', () => {
  it('knocks down every standing pin the bowler did not mark', () => {
    expect(toDelivery(FULL_RACK, pins(7, 10), false)).toEqual({ knocked: pins(1, 2, 3, 4, 5, 6, 8, 9), foul: false });
    expect(toDelivery(pins(7, 10), pins(10), true)).toEqual({ knocked: pins(7), foul: true });
  });
});

describe('the main button', () => {
  it.each([
    ['Strike on a fresh rack with nothing marked', firstBall, 0, false, 'Strike'],
    ['Spare on a second ball with nothing marked', secondBall(pins(10)), 0, false, 'Spare'],
    ['Miss when every pin is marked', secondBall(pins(7, 10)), pins(7, 10), false, 'Miss'],
    ['the leave otherwise', firstBall, pins(10), false, '10 left'],
    ['a foul that cleared the rack', firstBall, 0, true, 'Foul · all down'],
    ['a foul with a leave', firstBall, pins(7), true, 'Foul · 7 left'],
  ])('says %s', (_, next, marked, foul, label) => {
    expect(primaryAction(next, marked as PinMask, foul).label).toBe(label);
  });

  it('flags a split before the ball is recorded, on a fresh rack only', () => {
    expect(primaryAction(firstBall, pins(7, 10), false).isSplit).toBe(true);
    expect(primaryAction(firstBall, pins(7, 10), true).isSplit).toBe(false);
    expect(primaryAction(secondBall(pins(4, 7, 10)), pins(7, 10), false).isSplit).toBe(false);
    expect(primaryAction(firstBall, pins(2, 8), false).isSplit).toBe(false);
  });
});

describe('scoresheet marks', () => {
  const marks = (deliveries: { knocked: number; foul?: boolean }[]) => {
    const result = scoreGame(deliveries);
    if (!result.ok) throw new Error(result.error.message);
    return result.game.deliveries.map((d) => markFor(d));
  };

  it('writes strikes, spares, misses, fouls and counts the usual way', () => {
    expect(marks([{ knocked: FULL_RACK }, { knocked: 0 }, { knocked: pins(1, 2, 3, 4, 5, 6, 7, 8, 9, 10) }]).map((m) => m.text)).toEqual(['X', '-', '/']);
    expect(marks([{ knocked: pins(1, 2), foul: true }, { knocked: pins(1, 2, 3) }]).map((m) => m.text)).toEqual(['F', '3']);
  });

  it('rings a split', () => {
    expect(marks([{ knocked: pins(1, 2, 3, 4, 5, 6, 8, 9) }])).toEqual([{ text: '8', ringed: true }]);
  });
});

describe('uuidv7', () => {
  const random = new Uint8Array(10).fill(0xff);

  it('is a version 7, RFC 4122 variant UUID', () => {
    expect(uuidv7(1_790_000_000_000, random)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('starts with the timestamp, so IDs sort by creation time', () => {
    expect(uuidv7(0x0192_3456_789a, random).startsWith('01923456-789a-')).toBe(true);
    expect(uuidv7(1000, random) < uuidv7(1001, random)).toBe(true);
  });

  it('draws fresh randomness by default', () => {
    expect(uuidv7(1000)).not.toBe(uuidv7(1000));
  });
});
