import { FULL_RACK, type PinMask, maskFromPins, pinsFromMask, without } from '../src/pins';
import { type DeliveryInput, type ScoredGame, scoreGame } from '../src/scoring';

/** A ball by pin count, or 'F' for a foul that knocks nothing. */
export type Ball = number | 'F';

/**
 * Build deliveries from frames written the way a bowler reads a sheet:
 * [[10], [7, 3], [9, 0], ..., [10, 8, 1]].
 *
 * Each ball knocks the lowest-numbered standing pins. The rack logic here is
 * deliberately naive and separate from the engine, so tests never check the
 * engine against itself.
 */
export function fromFrames(frames: readonly (readonly Ball[])[]): DeliveryInput[] {
  const out: DeliveryInput[] = [];
  for (const balls of frames) {
    let rack: PinMask = FULL_RACK;
    for (const ball of balls) {
      if (ball === 'F') {
        out.push({ knocked: 0, foul: true });
        continue;
      }
      const standing = pinsFromMask(rack);
      if (ball > standing.length) throw new Error(`Test bug: ${ball} pins requested, ${standing.length} standing`);
      const knocked = maskFromPins(standing.slice(0, ball));
      out.push({ knocked });
      rack = without(rack, knocked);
      if (rack === 0) rack = FULL_RACK;
    }
  }
  return out;
}

export const mask = (...pins: number[]): PinMask => maskFromPins(pins);

/** The pins to knock from a full rack to leave exactly `pins` standing. */
export const leaving = (...pins: number[]): DeliveryInput => ({ knocked: without(FULL_RACK, mask(...pins)) });

export const STRIKE: DeliveryInput = { knocked: FULL_RACK };

export function score(input: readonly DeliveryInput[]): ScoredGame {
  const result = scoreGame(input);
  if (!result.ok) throw new Error(`Expected a legal game: ${result.error.message}`);
  return result.game;
}

export const cumulative = (game: ScoredGame) => game.frames.map((f) => f.cumulativeScore);
