import { describe, expect, it } from 'vitest';
import {
  classifyLeave,
  describeLeave,
  hasGap,
  isSplit,
  isWashout,
  leaveName,
} from '../src/leaves';
import { EMPTY, type PinMask, isStanding, mirrorPins } from '../src/pins';
import { mask } from './helpers';

const ALL_MASKS = Array.from({ length: 1024 }, (_, i) => i as PinMask);

describe('splits', () => {
  it.each([
    [[7, 10], 'bedposts'],
    [[4, 6, 7, 10], 'big four'],
    [[4, 6, 7, 9, 10], 'greek church'],
    [[4, 6, 7, 8, 10], 'greek church, left'],
    [[2, 7], 'baby split'],
    [[3, 10], 'baby split'],
    [[5, 7], 'wide open'],
    [[5, 10], 'dime store'],
    [[5, 7, 10], 'lily'],
    [[2, 7, 10], 'christmas tree'],
    [[3, 7, 10], 'christmas tree'],
    [[6, 7, 10], 'three pins, two groups'],
    [[7, 9], 'one pin missing in the back row'],
    [[8, 10], 'one pin missing in the back row'],
    [[4, 6], 'the 5 is missing'],
    [[4, 9], 'no pin connects them'],
    [[4, 10], 'no pin connects them'],
    [[2, 8, 10], 'a sleeper plus a far pin'],
  ])('%j is a split (%s)', (pins) => {
    expect(isSplit(mask(...pins))).toBe(true);
    expect(classifyLeave(mask(...pins))).toBe('split');
  });

  // USBC rule, second clause: "at least one pin is down immediately ahead of
  // and between two or more pins which remain standing, as for example 5-6".
  it.each([[5, 6], [4, 5], [8, 9], [9, 10], [7, 8], [2, 3]].map((pins) => [pins]))(
    '%j is a split because the pin in front of both is down',
    (pins) => {
      expect(isSplit(mask(...pins))).toBe(true);
    },
  );

  it.each([
    [[10], 'single pin'],
    [[7], 'single pin'],
    [[6, 10], 'touching'],
    [[3, 6, 10], 'a line of touching pins'],
    [[2, 4, 7], 'a line of touching pins'],
    [[2, 4, 5, 8], 'bucket'],
    [[3, 5, 6, 9], 'bucket'],
    [[2, 8], 'sleeper: nothing between them'],
    [[3, 9], 'sleeper: nothing between them'],
    [[2, 5, 9], 'diagonal chain'],
    [[5, 8, 9], 'the 5 covers both'],
    [[4, 5, 2], 'the 2 covers both'],
  ])('%j is not a split (%s)', (pins) => {
    expect(isSplit(mask(...pins))).toBe(false);
  });

  it('is never a split with the headpin standing', () => {
    for (const m of ALL_MASKS) if (isStanding(m, 1)) expect(isSplit(m)).toBe(false);
  });

  it('treats mirrored leaves identically', () => {
    for (const m of ALL_MASKS) {
      expect(isSplit(mirrorPins(m))).toBe(isSplit(m));
      expect(isWashout(mirrorPins(m))).toBe(isWashout(m));
    }
  });

  /*
   * The one known interpretive call. A literal reading of "a pin is down between
   * two standing pins" makes 2-4-5-7-9 a split, because the 8 is missing between
   * the 7 and the 9. Here the standing pins form one connected group, so it is not.
   * See docs/adr/0001-split-definition.md. If you choose the literal reading, this
   * test is the one to change.
   */
  it('does not call a connected leave with an interior hole a split (ADR 0001)', () => {
    expect(isSplit(mask(2, 4, 5, 7, 9))).toBe(false);
  });
});

describe('washouts', () => {
  it.each([[1, 2, 10], [1, 2, 4, 10], [1, 3, 7], [1, 3, 6, 7]].map((pins) => [pins]))('%j is a washout', (pins) => {
    expect(isWashout(mask(...pins))).toBe(true);
    expect(classifyLeave(mask(...pins))).toBe('washout');
  });

  it.each([[1, 2, 4, 7], [1, 3, 6, 10], [1, 5], [1, 2, 8], [1]].map((pins) => [pins]))('%j is not a washout', (pins) => {
    expect(isWashout(mask(...pins))).toBe(false);
  });

  it('is never both a split and a washout', () => {
    for (const m of ALL_MASKS) expect(isSplit(m) && isWashout(m)).toBe(false);
  });
});

describe('classification', () => {
  it('sorts every leave into exactly one kind', () => {
    expect(classifyLeave(EMPTY)).toBe('clear');
    expect(classifyLeave(mask(10))).toBe('single');
    expect(classifyLeave(mask(2, 4, 5, 8))).toBe('cluster');
    expect(classifyLeave(mask(7, 10))).toBe('split');
    expect(classifyLeave(mask(1, 2, 10))).toBe('washout');
  });

  it('only finds gaps between two or more pins', () => {
    expect(hasGap(EMPTY)).toBe(false);
    expect(hasGap(mask(7))).toBe(false);
  });

  it('names the famous leaves and nothing else', () => {
    expect(leaveName(mask(7, 10))).toBe('Bedposts');
    expect(leaveName(mask(4, 6, 7, 10))).toBe('Big Four');
    expect(leaveName(mask(10))).toBeUndefined();
  });

  it('describes a leave in one call', () => {
    expect(describeLeave(mask(4, 6, 7, 10))).toEqual({
      mask: mask(4, 6, 7, 10),
      pins: [4, 6, 7, 10],
      count: 4,
      kind: 'split',
      name: 'Big Four',
    });
  });
});
