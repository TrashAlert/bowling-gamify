/**
 * Pin masks.
 *
 * Pin N is bit (N - 1), so the whole rack fits in 10 bits (0..1023).
 * What a set bit means depends on the field holding the mask:
 *   - a rack or a leave: the pin is standing
 *   - a delivery's `knocked` field: the pin fell on that delivery
 *
 *   Row 4:  7   8   9   10
 *   Row 3:    4   5   6
 *   Row 2:      2   3
 *   Row 1:        1
 */

declare const pinMaskBrand: unique symbol;

/** A 10-bit set of pins. Branded so a plain number can't be passed by accident. */
export type PinMask = number & { readonly [pinMaskBrand]: true };

export type PinNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const PIN_NUMBERS: readonly PinNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const EMPTY = 0 as PinMask;
export const FULL_RACK = 0b11_1111_1111 as PinMask;

export function isPinNumber(value: unknown): value is PinNumber {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function isPinMask(value: unknown): value is PinMask {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= FULL_RACK;
}

/** Narrow a number to a PinMask, throwing on anything outside 0..1023. */
export function toPinMask(value: number): PinMask {
  if (!isPinMask(value)) {
    throw new RangeError(`Not a pin mask: ${value}. Expected an integer from 0 to 1023.`);
  }
  return value;
}

export function pinBit(pin: PinNumber): PinMask {
  return (1 << (pin - 1)) as PinMask;
}

export function maskFromPins(pins: Iterable<number>): PinMask {
  let mask = 0;
  for (const pin of pins) {
    if (!isPinNumber(pin)) throw new RangeError(`Not a pin number: ${pin}`);
    mask |= 1 << (pin - 1);
  }
  return mask as PinMask;
}

export function pinsFromMask(mask: PinMask): PinNumber[] {
  return PIN_NUMBERS.filter((pin) => (mask & (1 << (pin - 1))) !== 0);
}

export function pinCount(mask: PinMask): number {
  let count = 0;
  let rest: number = mask;
  while (rest !== 0) {
    rest &= rest - 1; // clear the lowest set bit
    count++;
  }
  return count;
}

export function isStanding(mask: PinMask, pin: PinNumber): boolean {
  return (mask & (1 << (pin - 1))) !== 0;
}

/** Pins in `a` that are not in `b`. */
export function without(a: PinMask, b: PinMask): PinMask {
  return (a & ~b & FULL_RACK) as PinMask;
}

/** "7-10" for the bedposts, "" for an empty mask. The form bowlers write and say. */
export function formatPins(mask: PinMask): string {
  return pinsFromMask(mask).join('-');
}

/**
 * Parse "7-10", "7 10", "4,6,7,10" or "" (empty). Returns null for anything
 * that isn't a list of pin numbers 1-10. Duplicates are harmless.
 */
export function parsePins(text: string): PinMask | null {
  const trimmed = text.trim();
  if (trimmed === '') return EMPTY;
  const parts = trimmed.split(/[\s,-]+/);
  const pins: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,2}$/.test(part)) return null;
    const pin = Number(part);
    if (!isPinNumber(pin)) return null;
    pins.push(pin);
  }
  return maskFromPins(pins);
}

const MIRROR: Readonly<Record<PinNumber, PinNumber>> = {
  1: 1, 2: 3, 3: 2, 4: 6, 5: 5, 6: 4, 7: 10, 8: 9, 9: 8, 10: 7,
};

/**
 * Reflect the rack left-to-right: 7 <-> 10, 4 <-> 6, 8 <-> 9, 2 <-> 3.
 * A left-hander's 7-pin is a right-hander's 10-pin, so the bestiary can
 * group mirrored leaves when a user switches hands or compares with a friend.
 */
export function mirrorPins(mask: PinMask): PinMask {
  let out = 0;
  for (const pin of pinsFromMask(mask)) out |= 1 << (MIRROR[pin] - 1);
  return out as PinMask;
}
