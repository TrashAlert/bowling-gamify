import { describe, expect, it } from 'vitest';
import { FULL_RACK } from '../src/pins';
import { type DeliveryInput, maxPossibleScore, scoreGame } from '../src/scoring';
import { STRIKE, cumulative, fromFrames, leaving, mask, score } from './helpers';

const NINE_OPEN_FRAMES = Array.from({ length: 9 }, () => [0, 0]);
const repeat = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => x);

describe('complete games', () => {
  it('scores a gutter game as 0', () => {
    const game = score(fromFrames(repeat(10, [0, 0])));
    expect(game.isComplete).toBe(true);
    expect(game.scoreSoFar).toBe(0);
    expect(game.frames.every((f) => f.isOpen)).toBe(true);
  });

  it('scores all ones as 20', () => {
    expect(score(fromFrames(repeat(10, [1, 1]))).scoreSoFar).toBe(20);
  });

  it('scores twelve strikes as 300', () => {
    const game = score(repeat(12, STRIKE));
    expect(cumulative(game)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
    expect(game.frames[9]!.deliveries).toHaveLength(3);
    expect(game.next).toBeNull();
  });

  it('scores eleven strikes and a nine as 299', () => {
    expect(score(fromFrames([...repeat(9, [10]), [10, 10, 9]])).scoreSoFar).toBe(299);
  });

  it('scores all 9-spares with a 9 fill as 190', () => {
    const game = score(fromFrames([...repeat(9, [9, 1]), [9, 1, 9]]));
    expect(game.scoreSoFar).toBe(190);
    expect(game.frames.every((f) => f.isSpare && !f.isOpen)).toBe(true);
  });

  it('scores all 5-spares with a 5 fill as 150', () => {
    expect(score(fromFrames([...repeat(9, [5, 5]), [5, 5, 5]])).scoreSoFar).toBe(150);
  });

  it('scores a Dutch 200 either way round', () => {
    const strikeFirst = [[10], [5, 5], [10], [5, 5], [10], [5, 5], [10], [5, 5], [10], [5, 5, 10]];
    const spareFirst = [[5, 5], [10], [5, 5], [10], [5, 5], [10], [5, 5], [10], [5, 5], [10, 5, 5]];
    expect(score(fromFrames(strikeFirst)).scoreSoFar).toBe(200);
    expect(score(fromFrames(spareFirst)).scoreSoFar).toBe(200);
  });

  it('scores a mixed game with a foul frame by frame', () => {
    // X  7/  9-  X  -8  8/  F6  X  X  X81
    const game = score(
      fromFrames([[10], [7, 3], [9, 0], [10], [0, 8], [8, 2], ['F', 6], [10], [10], [10, 8, 1]]),
    );
    expect(cumulative(game)).toEqual([20, 39, 48, 66, 74, 84, 90, 120, 148, 167]);
    expect(game.frames.map((f) => f.frameScore)).toEqual([20, 19, 9, 18, 8, 10, 6, 30, 28, 19]);
  });
});

describe('fouls', () => {
  it('counts a foul as zero and respots the pins that fell', () => {
    const game = score([
      { knocked: mask(1, 2, 3), foul: true },
      { knocked: FULL_RACK }, // the 1, 2 and 3 are back up, so this is legal
      { knocked: mask(1, 2, 3, 4, 5) },
    ]);
    const [foul, spare] = game.deliveries;
    expect(foul!.pinfall).toBe(0);
    expect(spare!.standingBefore).toBe(FULL_RACK);
    expect(spare!.isSpare).toBe(true);
    expect(spare!.isStrike).toBe(false);
    expect(game.frames[0]!.frameScore).toBe(15);
    expect(game.frames[0]!.firstBallLeave).toBeNull();
    expect(game.frames[0]!.isSplit).toBe(false);
  });

  it('ends a frame after a foul on the second ball', () => {
    const game = score(fromFrames([[7, 'F'], [0, 0]]));
    expect(game.frames[0]!.frameScore).toBe(7);
    expect(game.frames[0]!.isOpen).toBe(true);
  });

  it('treats a tenth-frame X-F-X as a spare on the third ball', () => {
    const game = score([...fromFrames(NINE_OPEN_FRAMES), STRIKE, { knocked: 0, foul: true }, STRIKE]);
    const tenth = game.frames[9]!;
    expect(tenth.frameScore).toBe(20);
    expect(tenth.deliveries[2]!.isSpare).toBe(true);
    expect(tenth.deliveries[2]!.isStrike).toBe(false);
    expect(game.isComplete).toBe(true);
  });

  it('gives a tenth-frame third ball after a foul then a full-rack spare', () => {
    const game = score(fromFrames([...NINE_OPEN_FRAMES, ['F', 10, 4]]));
    expect(game.frames[9]!.frameScore).toBe(14);
    expect(game.isComplete).toBe(true);
  });
});

describe('the tenth frame', () => {
  it.each([
    [[9, 1, 8], 18, 3],
    [[10, 7, 2], 19, 3],
    [[10, 10, 10], 30, 3],
    [[10, 9, 1], 20, 3],
    [[7, 2], 9, 2],
  ])('%j scores %i in %i balls', (balls, expected, ballCount) => {
    const game = score(fromFrames([...NINE_OPEN_FRAMES, balls]));
    expect(game.isComplete).toBe(true);
    expect(game.frames[9]!.frameScore).toBe(expected);
    expect(game.frames[9]!.deliveries).toHaveLength(ballCount);
  });

  it('calls X-9/ a strike frame, not a spare frame', () => {
    const tenth = score(fromFrames([...NINE_OPEN_FRAMES, [10, 9, 1]])).frames[9]!;
    expect(tenth.isStrike).toBe(true);
    expect(tenth.isSpare).toBe(false);
    expect(tenth.deliveries[2]!.isSpare).toBe(true);
  });

  it('flags a split on a reset rack, even though the frame started with a strike', () => {
    const game = score([...fromFrames(NINE_OPEN_FRAMES), STRIKE, leaving(7, 10)]);
    const tenth = game.frames[9]!;
    expect(tenth.deliveries[1]!.isSplit).toBe(true);
    expect(tenth.isSplit).toBe(false); // frame-level flag describes the first ball only
  });
});

describe('games in progress', () => {
  it('starts with nothing scored and a full rack', () => {
    const game = score([]);
    expect(game.frames).toEqual([]);
    expect(game.scoreSoFar).toBe(0);
    expect(game.next).toEqual({ frameNumber: 1, deliveryInFrame: 1, standing: FULL_RACK, newRack: true });
  });

  it('holds a strike open until both bonus balls are thrown', () => {
    expect(cumulative(score(fromFrames([[10]])))).toEqual([null]);
    expect(cumulative(score(fromFrames([[10], [7]])))).toEqual([null, null]);
    expect(cumulative(score(fromFrames([[10], [7, 2]])))).toEqual([19, 28]);
  });

  it('holds consecutive strikes open', () => {
    const game = score([STRIKE, STRIKE]);
    expect(cumulative(game)).toEqual([null, null]);
    expect(game.scoreSoFar).toBe(0);
  });

  it('marks a frame complete before its score is known', () => {
    const frame = score([STRIKE]).frames[0]!;
    expect(frame.isComplete).toBe(true);
    expect(frame.frameScore).toBeNull();
  });

  it('says what the next ball faces', () => {
    expect(score(fromFrames([[7]])).next).toEqual({
      frameNumber: 1,
      deliveryInFrame: 2,
      standing: mask(8, 9, 10),
      newRack: false,
    });
    expect(score([{ knocked: 0, foul: true }]).next).toMatchObject({ standing: FULL_RACK, newRack: false });
    expect(score([...fromFrames(NINE_OPEN_FRAMES), STRIKE]).next).toEqual({
      frameNumber: 10,
      deliveryInFrame: 2,
      standing: FULL_RACK,
      newRack: true,
    });
  });
});

describe('splits and leaves', () => {
  it('records the first-ball leave and flags a split', () => {
    const game = score([leaving(7, 10), { knocked: mask(7) }]);
    const frame = game.frames[0]!;
    expect(frame.firstBallLeave).toBe(mask(7, 10));
    expect(frame.isSplit).toBe(true);
    expect(frame.deliveries[1]!.isSplit).toBe(false); // only first balls at a new rack
    expect(frame.isOpen).toBe(true);
  });

  it('does not flag a spare leave as a split', () => {
    expect(score([leaving(10)]).frames[0]!.isSplit).toBe(false);
  });
});

describe('illegal input', () => {
  it('rejects knocking down a pin that is already down', () => {
    const result = scoreGame([{ knocked: mask(1, 2, 3, 4, 5, 6, 7) }, { knocked: mask(1, 8) }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PIN_NOT_STANDING');
    expect(result.error.deliveryIndex).toBe(1);
    expect(result.error.message).toContain('pins 1 were');
  });

  it.each([1024, -1, 2.5, Number.NaN])('rejects %s as a knocked mask', (knocked) => {
    const result = scoreGame([{ knocked }]);
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_MASK', deliveryIndex: 0 } });
  });

  it('rejects a ball after a perfect game', () => {
    const result = scoreGame(repeat(13, STRIKE));
    expect(result).toMatchObject({ ok: false, error: { code: 'GAME_ALREADY_COMPLETE', deliveryIndex: 12 } });
  });

  it('rejects a third tenth-frame ball after an open frame', () => {
    const input: DeliveryInput[] = [...fromFrames([...NINE_OPEN_FRAMES, [7, 2]]), { knocked: 0 }];
    expect(scoreGame(input)).toMatchObject({ ok: false, error: { code: 'GAME_ALREADY_COMPLETE' } });
  });
});

describe('maximum possible score', () => {
  const cases: [number[][], number][] = [
    [[], 300],
    [[[9]], 290],
    [[[9, 0]], 279],
    [[[9, 1]], 290],
  ];
  it.each(cases)('after %j the best reachable score is %i', (frames, expected) => {
    expect(maxPossibleScore(score(fromFrames(frames)))).toBe(expected);
  });

  it('equals the final score once the game is over', () => {
    const game = score(fromFrames([...repeat(9, [9, 1]), [9, 1, 9]]));
    expect(maxPossibleScore(game)).toBe(190);
  });
});

describe('my real games', () => {
  it('scores my game from last week', () => {
    const game = score(fromFrames([
      [10], [7, 3], [9, 0], [8, 1], [10],
      [10], [6, 4], [9, 0], [10], [10, 8, 1],
    ]));
    expect(cumulative(game)).toEqual([20, 39, 48, 57, 83, 103, 122, 131, 159, 178]);
  });
});
