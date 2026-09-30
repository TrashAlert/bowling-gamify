import {
  type DeliveryInput,
  EMPTY,
  type NextDelivery,
  type PinMask,
  type ScoredDelivery,
  formatPins,
  isSplit,
  without,
} from '@bowling-rpg/scoring';

/**
 * Throw entry in two taps or fewer. The bowler marks the pins STILL STANDING
 * after the ball; everything else fell. So a strike or spare is one tap on the
 * main button, a miss is one tap, and a typical leave is its pins plus one tap.
 */
export function toDelivery(standing: PinMask, leftStanding: PinMask, foul: boolean): DeliveryInput {
  return { knocked: without(standing, leftStanding), foul };
}

export interface PrimaryAction {
  readonly label: string;
  /** A split on a fresh rack, flagged live so the bowler sees it before recording. */
  readonly isSplit: boolean;
}

export function primaryAction(next: NextDelivery, leftStanding: PinMask, foul: boolean): PrimaryAction {
  let label: string;
  if (leftStanding === EMPTY) label = next.newRack ? 'Strike' : 'Spare';
  else if (leftStanding === next.standing) label = 'Miss';
  else label = `${formatPins(leftStanding)} left`;

  if (foul) label = `Foul · ${label === 'Strike' || label === 'Spare' ? 'all down' : label}`;
  return { label, isSplit: !foul && next.newRack && isSplit(leftStanding) };
}

export interface Mark {
  readonly text: string;
  /** Scoresheets ring a split's count. */
  readonly ringed: boolean;
}

/** The mark a scoresheet shows for one ball: X, /, F, - or a pin count. */
export function markFor(delivery: ScoredDelivery): Mark {
  const text = delivery.isStrike
    ? 'X'
    : delivery.isSpare
      ? '/'
      : delivery.foul
        ? 'F'
        : delivery.pinfall === 0
          ? '-'
          : String(delivery.pinfall);
  return { text, ringed: delivery.isSplit };
}
