import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  FULL_RACK,
  type PinMask,
  isPinMask,
  isPinNumber,
  isStanding,
  maskFromPins,
  mirrorPins,
  parsePins,
  pinBit,
  pinCount,
  pinsFromMask,
  toPinMask,
  without,
  formatPins,
} from '../src/pins';

const ALL_MASKS = Array.from({ length: 1024 }, (_, i) => i as PinMask);

describe('pin masks', () => {
  it('maps pin N to bit N-1', () => {
    expect(pinBit(1)).toBe(0b1);
    expect(pinBit(10)).toBe(0b10_0000_0000);
    expect(FULL_RACK).toBe(1023);
    expect(pinCount(FULL_RACK)).toBe(10);
    expect(pinCount(EMPTY)).toBe(0);
  });

  it('round-trips every possible mask through a pin list', () => {
    for (const m of ALL_MASKS) {
      expect(maskFromPins(pinsFromMask(m))).toBe(m);
      expect(pinCount(m)).toBe(pinsFromMask(m).length);
    }
  });

  it('knows which pins are standing', () => {
    const bedposts = maskFromPins([7, 10]);
    expect(isStanding(bedposts, 7)).toBe(true);
    expect(isStanding(bedposts, 8)).toBe(false);
  });

  it('subtracts pin sets', () => {
    expect(without(FULL_RACK, maskFromPins([1, 2, 3]))).toBe(maskFromPins([4, 5, 6, 7, 8, 9, 10]));
    expect(without(maskFromPins([7]), FULL_RACK)).toBe(EMPTY);
  });
});

describe('validation', () => {
  it.each([0, 1, 512, 1023])('accepts %i as a mask', (n) => {
    expect(isPinMask(n)).toBe(true);
    expect(toPinMask(n)).toBe(n);
  });

  it.each([-1, 1024, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s as a mask', (n) => {
    expect(isPinMask(n)).toBe(false);
    expect(() => toPinMask(n)).toThrow(RangeError);
  });

  it('rejects non-numbers', () => {
    expect(isPinMask('7')).toBe(false);
    expect(isPinMask(null)).toBe(false);
    expect(isPinNumber('7')).toBe(false);
  });

  it.each([0, 11, 1.5])('rejects %s as a pin number', (n) => {
    expect(isPinNumber(n)).toBe(false);
    expect(() => maskFromPins([n])).toThrow(RangeError);
  });
});

describe('formatting and parsing', () => {
  it('formats the way bowlers write leaves', () => {
    expect(formatPins(maskFromPins([10, 7]))).toBe('7-10');
    expect(formatPins(maskFromPins([4, 6, 7, 10]))).toBe('4-6-7-10');
    expect(formatPins(EMPTY)).toBe('');
  });

  it.each([
    ['7-10', [7, 10]],
    [' 7 - 10 ', [7, 10]],
    ['4,6,7,10', [4, 6, 7, 10]],
    ['10 7', [7, 10]],
    ['7-7-10', [7, 10]],
    ['', []],
  ])('parses %j', (text, pins) => {
    expect(parsePins(text)).toBe(maskFromPins(pins));
  });

  it.each(['11', '0', '7-', 'seven', '3.5', '100'])('refuses to parse %j', (text) => {
    expect(parsePins(text)).toBeNull();
  });

  it('round-trips every mask through text', () => {
    for (const m of ALL_MASKS) expect(parsePins(formatPins(m))).toBe(m);
  });
});

describe('mirroring', () => {
  it('reflects the rack left to right', () => {
    expect(mirrorPins(maskFromPins([7]))).toBe(maskFromPins([10]));
    expect(mirrorPins(maskFromPins([2, 4, 5, 8]))).toBe(maskFromPins([3, 5, 6, 9]));
    expect(mirrorPins(maskFromPins([1, 5]))).toBe(maskFromPins([1, 5]));
  });

  it('is its own inverse and preserves pin count', () => {
    for (const m of ALL_MASKS) {
      expect(mirrorPins(mirrorPins(m))).toBe(m);
      expect(pinCount(mirrorPins(m))).toBe(pinCount(m));
    }
  });
});
