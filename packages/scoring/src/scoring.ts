import { isSplit } from './leaves';
import {
  EMPTY,
  FULL_RACK,
  type PinMask,
  formatPins,
  isPinMask,
  pinCount,
  without,
} from './pins';

export const FRAMES_PER_GAME = 10;
export const MAX_DELIVERIES = 21;
export const PERFECT_GAME = 300;

/** One ball, as recorded. `knocked` is a plain number here because it arrives from I/O. */
export interface DeliveryInput {
  /** Pins that fell on this delivery. Must be a subset of the pins standing. */
  readonly knocked: number;
  /**
   * A foul counts zero pins, and the pins that fell are respotted. Explicitly
   * allows undefined so a parsed API payload can be passed straight in.
   */
  readonly foul?: boolean | undefined;
}

export interface ScoredDelivery {
  /** Position in the input array. */
  readonly index: number;
  readonly frameNumber: number;
  readonly deliveryInFrame: 1 | 2 | 3;
  readonly standingBefore: PinMask;
  readonly knocked: PinMask;
  /** Pins physically left standing after this ball, before any respot. */
  readonly leave: PinMask;
  /** Pins counted toward the score: zero on a foul. */
  readonly pinfall: number;
  readonly foul: boolean;
  /**
   * Thrown at a freshly set rack: the first ball of a frame, or a reset rack in
   * the tenth. A full rack after a foul respot is NOT new; clearing it is a spare.
   */
  readonly newRack: boolean;
  readonly isStrike: boolean;
  readonly isSpare: boolean;
  /** Split leave after a legal ball at a new rack. */
  readonly isSplit: boolean;
}

export interface ScoredFrame {
  readonly frameNumber: number;
  readonly deliveries: readonly ScoredDelivery[];
  readonly isComplete: boolean;
  readonly isStrike: boolean;
  /** Spare on the frame's first two balls. A tenth-frame X then 9/ is a strike frame, not a spare frame. */
  readonly isSpare: boolean;
  /** Complete, and neither a strike nor a spare on the first two balls. */
  readonly isOpen: boolean;
  readonly isSplit: boolean;
  /** Leave after the first ball; null when it was a foul. */
  readonly firstBallLeave: PinMask | null;
  /** Null until the frame and all its bonus balls are known. */
  readonly frameScore: number | null;
  /** Null from the first frame whose score is still pending. */
  readonly cumulativeScore: number | null;
}

export interface NextDelivery {
  readonly frameNumber: number;
  readonly deliveryInFrame: 1 | 2 | 3;
  readonly standing: PinMask;
  readonly newRack: boolean;
}

export interface ScoredGame {
  readonly deliveries: readonly ScoredDelivery[];
  readonly frames: readonly ScoredFrame[];
  readonly isComplete: boolean;
  /** Cumulative score of the last frame whose score is known. */
  readonly scoreSoFar: number;
  /** What the next ball faces, or null when the game is over. */
  readonly next: NextDelivery | null;
}

export type ScoringErrorCode = 'INVALID_MASK' | 'PIN_NOT_STANDING' | 'GAME_ALREADY_COMPLETE';

export interface ScoringError {
  readonly code: ScoringErrorCode;
  readonly deliveryIndex: number;
  readonly message: string;
}

export type ScoreResult =
  | { readonly ok: true; readonly game: ScoredGame }
  | { readonly ok: false; readonly error: ScoringError };

const fail = (code: ScoringErrorCode, deliveryIndex: number, message: string): ScoreResult => ({
  ok: false,
  error: { code, deliveryIndex, message },
});

/** Called after each ball is added, so `balls` is never empty. */
function frameIsOver(frameNumber: number, balls: readonly ScoredDelivery[]): boolean {
  const first = balls[0]!;
  if (frameNumber < FRAMES_PER_GAME) return first.isStrike || balls.length === 2;
  if (balls.length === 1) return false;
  if (balls.length === 3) return true;
  // Tenth frame: a third ball only if the first two cleared a rack. The second
  // ball can only be a strike if the first was, so checking it adds nothing.
  return !(first.isStrike || balls[1]!.isSpare);
}

/**
 * Score a game from its deliveries, in order.
 *
 * Accepts a partial game: frames whose bonus balls haven't been thrown have a
 * null score, and `next` says what the following ball faces. Returns a typed
 * error, never throws, for input that can't be a legal game.
 */
export function scoreGame(input: readonly DeliveryInput[]): ScoreResult {
  const deliveries: ScoredDelivery[] = [];
  const byFrame: ScoredDelivery[][] = [[]];

  let frameNumber = 1;
  let rack: PinMask = FULL_RACK;
  let newRack = true;
  let complete = false;

  for (const [index, raw] of input.entries()) {
    if (complete) {
      return fail('GAME_ALREADY_COMPLETE', index, `Delivery ${index + 1} comes after the game ended.`);
    }
    if (!isPinMask(raw.knocked)) {
      return fail('INVALID_MASK', index, `Delivery ${index + 1}: ${raw.knocked} is not a pin mask (0-1023).`);
    }

    const knocked = raw.knocked;
    const notStanding = without(knocked, rack);
    if (notStanding !== EMPTY) {
      return fail(
        'PIN_NOT_STANDING',
        index,
        `Delivery ${index + 1}: pins ${formatPins(notStanding)} were already down.`,
      );
    }

    const balls = byFrame[frameNumber - 1]!;
    const foul = raw.foul === true;
    const leave = without(rack, knocked);
    const cleared = !foul && leave === EMPTY;

    const delivery: ScoredDelivery = {
      index,
      frameNumber,
      deliveryInFrame: (balls.length + 1) as 1 | 2 | 3,
      standingBefore: rack,
      knocked,
      leave,
      pinfall: foul ? 0 : pinCount(knocked),
      foul,
      newRack,
      isStrike: cleared && newRack,
      isSpare: cleared && !newRack,
      isSplit: newRack && !foul && isSplit(leave),
    };
    deliveries.push(delivery);
    balls.push(delivery);

    // Set up the rack for the next ball.
    if (foul) {
      newRack = false; // pins respotted: same rack, but no longer a fresh one
    } else if (cleared) {
      rack = FULL_RACK;
      newRack = true;
    } else {
      rack = leave;
      newRack = false;
    }

    if (frameIsOver(frameNumber, balls)) {
      if (frameNumber === FRAMES_PER_GAME) {
        complete = true;
      } else {
        frameNumber++;
        byFrame.push([]);
        rack = FULL_RACK;
        newRack = true;
      }
    }
  }

  const pinfalls = deliveries.map((d) => d.pinfall);
  /** Pinfall of the `count` balls after `index`, or null if they haven't been thrown. */
  const bonus = (index: number, count: number): number | null => {
    const balls = pinfalls.slice(index + 1, index + 1 + count);
    return balls.length === count ? balls.reduce((a, b) => a + b, 0) : null;
  };

  const frames: ScoredFrame[] = [];
  let running = 0;

  for (const [i, balls] of byFrame.entries()) {
    const [first, second] = balls;
    if (!first) continue; // the empty frame waiting for its first ball

    const number = i + 1;
    const isComplete = number < frameNumber || complete;
    const own = balls.reduce((sum, d) => sum + d.pinfall, 0);
    const last = balls.at(-1)!;
    const isSpare = second?.isSpare ?? false;

    let frameScore: number | null = null;
    if (isComplete) {
      if (number === FRAMES_PER_GAME) {
        frameScore = own;
      } else if (first.isStrike) {
        const b = bonus(last.index, 2);
        frameScore = b === null ? null : own + b;
      } else if (isSpare) {
        const b = bonus(last.index, 1);
        frameScore = b === null ? null : own + b;
      } else {
        frameScore = own;
      }
    }

    // Once a frame is pending, every later frame is too: its bonus balls are
    // the later frames' balls, so none of them can be finished and scored yet.
    // A property test holds this invariant in place.
    let cumulativeScore: number | null = null;
    if (frameScore !== null) {
      running += frameScore;
      cumulativeScore = running;
    }

    frames.push({
      frameNumber: number,
      deliveries: balls,
      isComplete,
      isStrike: first.isStrike,
      isSpare,
      isOpen: isComplete && !first.isStrike && !isSpare,
      isSplit: first.isSplit,
      firstBallLeave: first.foul ? null : first.leave,
      frameScore,
      cumulativeScore,
    });
  }

  const next: NextDelivery | null = complete
    ? null
    : {
        frameNumber,
        deliveryInFrame: (byFrame[frameNumber - 1]!.length + 1) as 1 | 2 | 3,
        standing: rack,
        newRack,
      };

  return {
    ok: true,
    game: { deliveries, frames, isComplete: complete, scoreSoFar: running, next },
  };
}

/**
 * The best score still reachable: every remaining ball knocks down everything standing.
 * Shown live during a game ("still possible: 245").
 */
export function maxPossibleScore(game: ScoredGame): number {
  const inputs: DeliveryInput[] = game.deliveries.map((d) => ({ knocked: d.knocked, foul: d.foul }));
  let current = game;
  while (current.next) {
    inputs.push({ knocked: current.next.standing });
    const result = scoreGame(inputs);
    // Knocking down exactly the standing pins is always legal.
    /* v8 ignore next */
    if (!result.ok) throw new Error(`Invariant broken in maxPossibleScore: ${result.error.message}`);
    current = result.game;
  }
  return current.scoreSoFar;
}
