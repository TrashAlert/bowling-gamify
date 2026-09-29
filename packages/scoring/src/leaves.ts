import {
  type PinMask,
  type PinNumber,
  PIN_NUMBERS,
  isStanding,
  maskFromPins,
  pinCount,
  pinsFromMask,
} from './pins';

/**
 * Pins that "cover" each other for split purposes. See docs/adr/0001-split-definition.md.
 *
 * Diagonal neighbours touch, so a ball or pin can carry from one to the other.
 * Sleepers (a pin directly behind another, e.g. 2-8) have no pin between them,
 * so the USBC "a pin is down between them" test can never be met.
 *
 * Same-row neighbours (4-5, 8-9, ...) are deliberately NOT linked. The USBC
 * rule makes 5-6 a split because the 3-pin "immediately ahead of and between"
 * them is down; when that front pin is standing they're linked through it anyway.
 */
const LINKS: ReadonlyArray<readonly [PinNumber, PinNumber]> = [
  // diagonal neighbours
  [1, 2], [1, 3],
  [2, 4], [2, 5], [3, 5], [3, 6],
  [4, 7], [4, 8], [5, 8], [5, 9], [6, 9], [6, 10],
  // sleepers
  [1, 5], [2, 8], [3, 9],
];

/** NEIGHBOURS[pin - 1] = mask of pins linked to `pin`. */
const NEIGHBOURS: readonly number[] = PIN_NUMBERS.map((pin) =>
  LINKS.reduce((acc, [a, b]) => {
    if (a === pin) return acc | (1 << (b - 1));
    if (b === pin) return acc | (1 << (a - 1));
    return acc;
  }, 0),
);

/** Number of separate groups the standing pins fall into. */
function groupCount(mask: PinMask): number {
  let unvisited: number = mask;
  let groups = 0;
  while (unvisited !== 0) {
    groups++;
    let frontier = unvisited & -unvisited; // lowest standing pin not yet grouped
    let group = 0;
    while (frontier !== 0) {
      group |= frontier;
      let reach = 0;
      for (let bit = 0; bit < 10; bit++) {
        if (frontier & (1 << bit)) reach |= NEIGHBOURS[bit]! & mask;
      }
      frontier = reach & ~group;
    }
    unvisited &= ~group;
  }
  return groups;
}

/** Two or more standing pins with a gap between them. */
export function hasGap(leave: PinMask): boolean {
  return pinCount(leave) >= 2 && groupCount(leave) > 1;
}

/** USBC split: headpin down, and a gap between standing pins. */
export function isSplit(leave: PinMask): boolean {
  return !isStanding(leave, 1) && hasGap(leave);
}

/** Headpin standing, with a gap elsewhere (e.g. 1-2-10). Not a split by rule, but just as hard. */
export function isWashout(leave: PinMask): boolean {
  return isStanding(leave, 1) && hasGap(leave);
}

export type LeaveKind = 'clear' | 'single' | 'cluster' | 'split' | 'washout';

export function classifyLeave(leave: PinMask): LeaveKind {
  const count = pinCount(leave);
  if (count === 0) return 'clear';
  if (count === 1) return 'single';
  if (isSplit(leave)) return 'split';
  if (isWashout(leave)) return 'washout';
  return 'cluster';
}

/**
 * Traditional names for well-known leaves. Deliberately short: only names in
 * wide use. Game-flavoured monster names belong in `progression`, not here.
 */
const NAMES: ReadonlyMap<number, string> = new Map<number, string>([
  [maskFromPins([7, 10]), 'Bedposts'],
  [maskFromPins([4, 6, 7, 10]), 'Big Four'],
  [maskFromPins([4, 6, 7, 9, 10]), 'Greek Church'],
  [maskFromPins([4, 6, 7, 8, 10]), 'Greek Church'],
  [maskFromPins([2, 7]), 'Baby Split'],
  [maskFromPins([3, 10]), 'Baby Split'],
  [maskFromPins([5, 7, 10]), 'Lily'],
  [maskFromPins([2, 7, 10]), 'Christmas Tree'],
  [maskFromPins([3, 7, 10]), 'Christmas Tree'],
  [maskFromPins([5, 10]), 'Dime Store'],
  [maskFromPins([2, 4, 5, 8]), 'Bucket'],
  [maskFromPins([3, 5, 6, 9]), 'Bucket'],
  [maskFromPins([1, 2, 4, 7]), 'Picket Fence'],
  [maskFromPins([1, 3, 6, 10]), 'Picket Fence'],
  [maskFromPins([1, 2, 10]), 'Washout'],
  [maskFromPins([1, 2, 4, 10]), 'Washout'],
  [maskFromPins([1, 3, 7]), 'Washout'],
  [maskFromPins([1, 3, 6, 7]), 'Washout'],
  [maskFromPins([2, 8]), 'Sleeper'],
  [maskFromPins([3, 9]), 'Sleeper'],
  [maskFromPins([1, 5]), 'Sleeper'],
]);

export function leaveName(leave: PinMask): string | undefined {
  return NAMES.get(leave);
}

export interface LeaveInfo {
  readonly mask: PinMask;
  readonly pins: readonly PinNumber[];
  readonly count: number;
  readonly kind: LeaveKind;
  readonly name: string | undefined;
}

export function describeLeave(leave: PinMask): LeaveInfo {
  return {
    mask: leave,
    pins: pinsFromMask(leave),
    count: pinCount(leave),
    kind: classifyLeave(leave),
    name: leaveName(leave),
  };
}

